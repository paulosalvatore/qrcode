$(function(){
	if (!("mediaDevices" in navigator &&
		"getUserMedia" in navigator.mediaDevices &&
		"Worker" in window))
	{
		alert("Desculpe, seu navegador não é compatível com essa aplicação.");

		return;
	}

	// html elements
	const snapshotCanvas = document.getElementById("snapshot");
	const snapshotContext = snapshotCanvas.getContext("2d");
	const video = document.getElementById("camera");
	const overlay = document.getElementById("snapshotLimitOverlay");
	const flipCameraButton = document.getElementById("flipCamera");
	flipCameraButtonJ = $("#flipCamera");
	const loadingElement = document.getElementById("loading");
	const resultContainer = document.getElementById("result");
	const resultDialog = document.querySelector("dialog");
	const resultSearchGo = document.querySelector("dialog a.search");

	// init dialog
	dialogPolyfill.registerDialog(resultDialog);
	resultDialog.querySelector("button.continue").addEventListener("click", function() {
		resultDialog.close();
		resultContainer.innerText = "";
		flipCameraButtonJ.show();
		flipCameraButton.disabled = false;
		scanCode(true);
	});

	new Clipboard("dialog button.copy");

	// init QRCode Web Worker
	const qrcodeWorker = new Worker("assets/qrcode_worker.js");
	qrcodeWorker.postMessage({cmd: "init"});
	qrcodeWorker.addEventListener("message", showResult);

	var snapshotSquare;
	function calculateSquare()
	{
		// get square of snapshot in the video
		var snapshotSize = overlay.offsetWidth;
		snapshotSquare = {
			"x": ~~((video.videoWidth - snapshotSize)/2),
			"y": ~~((video.videoHeight - snapshotSize)/2),
			"size": ~~(snapshotSize)
		};

		snapshotCanvas.width = snapshotSquare.size;
		snapshotCanvas.height = snapshotSquare.size;
	}

	function scanCode(wasSuccess)
	{
		setTimeout(function()
		{
			if (flipCameraButton.disabled)
			{
				// terminate this loop
				loadingElement.style.display = "none";
				return;
			}

			// show loading
			loadingElement.style.display = "block";

			// capture current snapshot
			snapshotContext.drawImage(video, snapshotSquare.x, snapshotSquare.y, snapshotSquare.size, snapshotSquare.size, 0, 0, snapshotSquare.size, snapshotSquare.size);
			const imageData = snapshotContext.getImageData(0, 0, snapshotSquare.size, snapshotSquare.size);

			// scan for QRCode
			qrcodeWorker.postMessage({
				cmd: "process",
				width: snapshotSquare.size,
				height: snapshotSquare.size,
				imageData: imageData
			});
		}, wasSuccess ? 2000 : 120);
	}

	function showResult(e){
		const resultData = e.data;

		// open a dialog with the result if found
		if (resultData !== false)
		{
			navigator.vibrate(200);

			disableUI();

			location.href = resultData;

			/*
			try {
				url = new URL(resultData);


				url = new URL(resultData);

				var linkToResult = document.createElement("a");
				linkToResult.href = url;
				linkToResult.innerText = resultData;
				resultContainer.appendChild(linkToResult);

				resultSearchGo.href = url;
				resultSearchGo.innerText = "Abrir";
			} catch (e) {
				resultContainer.innerText = resultData;

				resultSearchGo.href = "https://www.google.com.br/search?q=" + encodeURIComponent(resultData);
				resultSearchGo.innerText = "Pesquisar";
			}

			resultDialog.showModal();
			*/
		}
		// if not found, retry
		else
			scanCode();
	}

	function disableUI()
	{
		flipCameraButtonJ.hide();
		flipCameraButton.disabled = true;
		loadingElement.style.display = "none";
	}

	// init video stream
	var currentDeviceId;

	var inicial = true;

	function initVideoStream()
	{
		var config = {
			audio: false,
			video: {}
		};

		config.video = currentDeviceId ? {deviceId: currentDeviceId} : {facingMode: "environment"};

		stopStream();

		navigator.mediaDevices.getUserMedia(config).then(function (stream) {
			document.getElementById("about").style.display = "none";

			video.srcObject = stream;
			video.oncanplay = function()
			{
				flipCameraButtonJ.show();
				flipCameraButton.disabled = false;
				calculateSquare();
				scanCode();
			};

			if (inicial)
			{
				setTimeout(function(){
					flipCameraButtonJ.click();
					inicial = false;
				}, 100);
			}

		}).catch(function(error)
		{
			flipCameraButtonJ.show();
			flipCameraButton.disabled = false;

			if (inicial)
			{
				flipCameraButtonJ.click();
				inicial = false;
			}
		});
	}

	function stopStream()
	{
		disableUI();

		if (video.srcObject)
			video.srcObject.getTracks()[0].stop();
	}

	// listen for optimizedResize
	window.addEventListener("optimizedResize", calculateSquare);

	// add flip camera button if necessary
	navigator.mediaDevices.enumerateDevices()
	.then(function(devices){
		devices = devices.filter(function(device){
			return device.kind === "videoinput";
		});

		if (devices.length > 1)
		{
			currentDeviceId = devices[0].deviceId; // no way to know current MediaStream's device id so arbitrarily choose the first

			flipCameraButton.addEventListener("click", function(){
				var targetDevice;
				for (var i = 0; i < devices.length; i++)
				{
					if (devices[i].deviceId === currentDeviceId)
					{
						targetDevice = (i + 1 < devices.length) ? devices[i+1] : devices[0];
						break;
					}
				}

				currentDeviceId = targetDevice.deviceId;

				initVideoStream();
			});
		}
	});

	var videoIniciado = false;

	document.addEventListener("visibilitychange", function(){
		if (!videoIniciado)
			return;

		if (document.hidden)
			stopStream();
		else
			initVideoStream();
	});

	$("#iniciarCamera").click(function(){
		videoIniciado = true;

		initVideoStream();

		flipCameraButtonJ.click();
	});

	$(window).resize(function(){
		var iniciarCameraJ = $("#iniciarCamera");
		var alturaPorcentagem = parseInt(iniciarCameraJ.data("altura")) / 100;
		var larguraBody = parseInt($("body").css("height").split("px").join(""));
		var altura = alturaPorcentagem * larguraBody;

		iniciarCameraJ.css("height", altura);
	}).resize();
});

// listen for resize event
(function(){
	var throttle = function(type, name, obj){
		obj = obj || window;

		var running = false;

		var func = function(){
			if (running)
				return;

			running = true;

			requestAnimationFrame(function(){
				obj.dispatchEvent(new CustomEvent(name));
				running = false;
			});
		};

		obj.addEventListener(type, func);
	};

	/* init - you can init any event */
	throttle("resize", "optimizedResize");
})();

