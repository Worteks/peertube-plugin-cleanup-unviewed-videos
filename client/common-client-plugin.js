var defaultYears = 3;
var enableDeletion = true;

// Enable for testing only
const testForceSelectedVideos = false;
const debugLog = false;

// month -> days helpers
function bisextile(year) {
	return year % 4 == 0 && (year % 100 > 0 || year % 400 == 0);
}
function days(h, year) {
	return (
		h * 30 +
		Math.round((h - 1) / 2) +
		(h % 2) +
		(h > 7 ? 1 : 0) -
		(h > 1 ? 2 - bisextile(year) : 0)
	);
}

function delta_days(first, last, year) {
	let g = days(last, year);
	let f = days(first, year);
	return g - f;
}

function delta_days_overlap(months, last, year) {
	let d = 0;

	if (months <= last) {
		d = delta_days(last - months, last, year);
	} else if (months <= 12) {
		let g = days(last, year);
		let e = delta_days(12 + last - months, 12, year - 1);
		d = g + e;
	}
	return d;
}

//

async function register({
	registerHook,
	registerSettingsScript,
	registerClientRoute,
	peertubeHelpers,
}) {
	registerHook({
		target: "action:application.init",
		handler: () => onApplicationInit(peertubeHelpers),
	});

	registerHook({
		target: "action:auth-user.information-loaded",
		handler: ({ user }) => {
			//        0 : UserRole.ADMINISTRATOR
			if (user.role.id == 0) {
				document.body.classList.add("show-manage-unviewed");
			} else {
				document.body.classList.remove("show-manage-unviewed");
			}
		},
	});

	registerHook({
		target: "filter:left-menu.links.create.result",
		handler: async (result) => {
			return [
				{
					key: "manage-unviewed",
					title: await peertubeHelpers.translate("Manage Unviewed"),
					links: [
						{
							path:
								peertubeHelpers.getBasePluginClientPath() +
								"/manage-unviewed/route",
							icon: "",
							shortLabel: await peertubeHelpers.translate("Unviewed"),
							label: await peertubeHelpers.translate("Unviewed"),
						},
					],
				},
			].concat(result);
		},
	});

	// Router hooks

	// Modal hooks

	// Settings

	registerSettingsScript({
		isSettingHidden: (options) => {
			if(debugLog) console.log(options);
			if (
				options.setting.name === "my-markdown-area" &&
				options.formValues.select === "2"
			) {
				return true;
			}
			return false;
		},
	});

	// Routes

	function submitHandler(event) {
		event.preventDefault();
		if(debugLog) console.log("LISTENER");
		validateFormOnSubmit(event);
	}

	function validateFormOnSubmit(event) {
		if(debugLog) console.log(event);
		if (event.submitter.name == "select-unviewed") {
			if(debugLog) console.log(document.body.classList);
			document.body.classList.add("video-deletion-running");
			if(debugLog) console.log("validate form on submit");

			if(debugLog) console.log(event.target.elements[0].value);
			if(debugLog) console.log("" + document.defaultView.localStorage.getItem("access_token"));

			selectVideos();
		}
		if (event.submitter.name == "delete-unviewed") {
			deleteSelectedVideos();
		}
	}

	registerClientRoute({
		route: "manage-unviewed/route",
		onMount: async ({ rootEl }) => {
			const div = document.createElement("div");
			div.setAttribute("class", "right-form");
			const title = document.createElement("h1");
			title.append(await peertubeHelpers.translate("Unviewed"));
			const form = document.createElement("form");
			if (form.addEventListener) {
				form.addEventListener("submit", (event) => submitHandler(event), true);
			} else {
				form.attachEvent("onsubmit", (event) => submitHandler(event));
			}
			form.action = "validateFromOnSubmit()";
			form.innerHTML =
				"<div>" +
				(await peertubeHelpers.translate("number of years ago")) +
				"</div>" +
				'<input type="number" name="number-of-years-ago" value="' +
				defaultYears +
				'"/>' +
				"<div>" +
				(await peertubeHelpers.translate("number of months ago")) +
				"</div>" +
				'<input type="number" name="number-of-months-ago" value="0"/>' +
				'<br><input type="submit" name="select-unviewed" value="Select"><input type="submit" name="delete-unviewed" value="Delete"></div>';
			div.appendChild(title);
			div.appendChild(form);
			const progressBar = document.createElement("progress");
			progressBar.setAttribute("name", "progress-bar");
			progressBar.setAttribute("value", 0);
			progressBar.setAttribute("max", 100);
			const deleteBar = document.createElement("progress");
			deleteBar.setAttribute("name", "delete-bar");
			deleteBar.setAttribute("value", 0);
			deleteBar.setAttribute("max", 100);
			const progress = document.createElement("table");
			progress.setAttribute("name", "progress");
			div.appendChild(progressBar);
			div.appendChild(deleteBar);
			div.appendChild(progress);
			rootEl.appendChild(div);
			const deleteUnviewed = document.getElementsByName("delete-unviewed")[0];
			deleteUnviewed.hidden = !enableDeletion;
			const jsonCollected = document.defaultView.localStorage.getItem(
				"selectedVideos",
				"[]",
			);
			if (jsonCollected) {
				const collected = JSON.parse(jsonCollected);
				if (collected.length > 0) {
					addProgressRow(
						progress,
						"NOTE: " +
							collected.length +
							" videos are already selected for deletion in this browser",
					);
				}
			}
		},
	});

	registerClientRoute({
		route: "manage-unviewed/route/delete",
		onMount: ({ rootEl }) => {
			if(debugLog) console.log("".localStorage.getItem("access_token"));
		},
	});
}

export { register };

function addProgressRow(progress, text) {
	const p = document.createElement("tr");
	p.append(text);
	progress.appendChild(p);
}

async function onApplicationInit(peertubeHelpers) {
	if(debugLog) console.log("Manage Unviewed");

	const baseStaticUrl = peertubeHelpers.getBaseStaticRoute();

	peertubeHelpers
		.getServerConfig()
		.then((config) => logdebug("Got server config.", config));

	const settings = await peertubeHelpers.getSettings();
	if(debugLog) console.log("Settings " + settings);
	enableDeletion = settings["enable-deletion"];
	defaultYears = settings["default-years"];
	if(debugLog) console.log("enableDeletion", enableDeletion);
}

async function deleteVideo(shortUUID, progress, deleteBar) {
	const url = "/api/v1/videos/" + shortUUID;
	const access_token =
		document.defaultView.localStorage.getItem("access_token");

	try {
		const response = await fetch(url, {
			method: "DELETE",
			headers: {
				Authorization: "Bearer " + access_token,
			},
		});
		if (!response.ok) {
			addProgressRow(
				progress,
				"Error when calling deletion api " +
					shortUUID +
					" status " +
					response.status,
			);
			throw new Error(`Response status: ${response.status}`);
		}
		var deleted = deleteBar.getAttribute("value");
		deleteBar.setAttribute("value", deleted + 1);
		const text = "video deleted " + shortUUID;
		addProgressRow(progress, text);
		if(debugLog) console.log(text);
	} catch (error) {
		console.error(error.message);
	}
}

async function getViews(shortUUID, startDate, endDate, progress, deleteBar) {
	return true;
	const access_token =
		document.defaultView.localStorage.getItem("access_token");
	const url =
		"/api/v1/videos/" +
		shortUUID +
		"/stats/overall?startDate=" +
		startDate.toISOString() +
		"&endDate=" +
		endDate.toISOString();

	// default to no deletion
	var totalWatchTime = 1;
	var totalViewers = 1;

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: "Bearer " + access_token,
			},
		});
		if (!response.ok) {
			throw new Error(`Response status: ${response.status}`);
		}
		const json = await response.json();
		if(debugLog) console.log(json);
		totalWatchTime = json.totalWatchTime;
		totalViewers = json.totalViewers;
		if (totalWatchTime == 0 && totalViewers == 0) {
			const text = "select video for deletion " + shortUUID;
			addProgressRow(progress, text);
			if(debugLog) console.log(text);
			return true;
		} else {
			const text =
				"skip Video " +
				shortUUID +
				" since totalWatchTime=" +
				totalWatchTime +
				" totalViewers=" +
				totalViewers;
			addProgressRow(progress, text);
			if(debugLog) console.log(text);
			return false;
		}
	} catch (error) {
		console.error(error.message);
	}
	return false;
}

async function selectForDeletion(
	videos,
	startDate,
	endDate,
	progress,
	deleteBar,
) {
	var collected = new Array();
	const addviewed = async function (jsonVideo) {
		var shortUUID = jsonVideo.shortUUID;
		if(debugLog) console.log(shortUUID);
		const keep = await getViews(
			shortUUID,
			startDate,
			endDate,
			progress,
			deleteBar,
		);
		if (keep) {
			collected.push(shortUUID);
			if(debugLog) console.log("collected", collected);
		}
	};
	// can't use forEach on async function
	// videos.forEach(addviewed)
	for (const viewed of videos) {
		await addviewed(viewed);
	}
	if(debugLog) console.log(collected);
	var jsonCollected = JSON.stringify(collected);
	if(debugLog) console.log(jsonCollected);

	return collected;
}

async function selectVideos() {
	const access_token =
		document.defaultView.localStorage.getItem("access_token");

	const year = new Date().getFullYear();
	var start = 0;
	var count = 100;
	var total = 1;
	const numberOfYearsAgoInput = document.getElementsByName(
		"number-of-years-ago",
	)[0];
	const numberOfYearsAgo = numberOfYearsAgoInput.value;
	if(debugLog) console.log(numberOfYearsAgo);

	const numberOfMonthsAgoInput = document.getElementsByName(
		"number-of-months-ago",
	)[0];
	const numberOfMonthsAgo = parseInt(numberOfMonthsAgoInput.value);
	if(debugLog) console.log(numberOfMonthsAgo);

	const progressBar = document.getElementsByName("progress-bar")[0];
	const progress = document.getElementsByName("progress")[0];
	const deleteUnviewed = document.getElementsByName("delete-unviewed")[0];

	deleteUnviewed.hidden = !enableDeletion;

	// reset stored videos and cleanup textarea
	{
		progress.replaceChildren();
		const jsonCollected = document.defaultView.localStorage.getItem(
			"selectedVideos",
			"[]",
		);
	}

	if (
		numberOfYearsAgo > 0 ||
		(numberOfMonthsAgo > 0 && numberOfMonthsAgo < 12)
	) {
		deleteUnviewed.disabled = true;
		const currentDate = new Date();
		var startDate = new Date();
		startDate.setDate(
			currentDate.getDate() -
				numberOfYearsAgo * 365 -
				delta_days_overlap(numberOfMonthsAgo, year - numberOfYearsAgo),
		);
		const startDateSinceEpoch = startDate.getTime() / 1000;
		var endDate = currentDate;
		var jsonVideo = {};
		var toDelete = new Array();
		addProgressRow(
			progress,
			"Collect all videos start date for deletion " + startDate,
		);
		try {
			while (start < total) {
				const url =
					"/api/v1/videos?isLocal=true&privacyOneOf=1&privacyOneOf=4&privacyOneOf=3&privacyOneOf=2&privacyOneOf=5&start=" +
					start +
					"&count=" +
					count;

				const response = await fetch(url, {
					headers: {
						Authorization: "Bearer " + access_token,
					},
				});
				if (!response.ok) {
					throw new Error(`Response status: ${response.status}`);
				}
				const json = await response.json();
				if(debugLog) console.log(json);
				total = json.total;
				var pos = start;
				if (total > 0) {
					progressBar.setAttribute("max", total - 1);
					for (pos = start; pos < start + count && pos < total; pos++) {
						progressBar.setAttribute("value", pos);
						var jsonVideo = json.data[pos - start];
						var shortUUID = jsonVideo.shortUUID;
						var publishedAt = jsonVideo.publishedAt;
						var publishedAtSinceEpoch = new Date(publishedAt).getTime() / 1000;
						if (publishedAtSinceEpoch > startDateSinceEpoch) {
							const text =
								"should skip video" +
								pos +
								" " +
								shortUUID +
								" publishedAt " +
								publishedAt +
								" after deletion period";
							if(debugLog) console.log(text);
						} else {
							toDelete.push(jsonVideo);
						}
					}
				}
				start = pos;
			}
		} catch (error) {
			console.error(error.message);
		}

		if (testForceSelectedVideos) {
			// TEST ONLY
			if(debugLog) console.log("WARNING TEST testForceSelectedVideos");
			toDelete = ["ahahah", "lfkjqdslfkj", "lkdjsKL"];
		}

		const deleteBar = document.getElementsByName("delete-bar")[0];
		const toDeleteLength = toDelete.length;
		deleteBar.setAttribute("max", 0);
		deleteBar.setAttribute("value", 0);
		if (toDeleteLength > 0) {
			deleteBar.setAttribute("max", toDeleteLength);
			addProgressRow(progress, "checking " + toDeleteLength + " videos.");
			var collected = [];
			if (testForceSelectedVideos) {
				// TEST ONLY
				if(debugLog) console.log("WARNING TEST");
				collected = ["ahahah", "lfkjqdslfkj", "lkdjsKL"];
			} else {
				collected = await selectForDeletion(
					toDelete,
					startDate,
					endDate,
					progress,
					deleteBar,
				);
			}
			const jsonCollected = JSON.stringify(collected);
			if(debugLog) console.log(jsonCollected);
			// save collectecd into local storage
			document.defaultView.localStorage.setItem(
				"selectedVideos",
				jsonCollected,
			);
			deleteUnviewed.disabled = false;
		} else {
			deleteBar.setAttribute("max", 0);
			addProgressRow(progress, "no video published before deletion period.");
			addProgressRow(progress, "local task compteted.");

			deleteUnviewed.disabled = true;
			document.defaultView.localStorage.setItem("selectedVideos", "[]");
		}
	} else {
		addProgressRow(progress, "number of years or days invalid");
	}
}

async function deleteSelectedVideos() {
	const progress = document.getElementsByName("progress")[0];
	const deleteUnviewed = document.getElementsByName("delete-unviewed")[0];
	const deleteBar = document.getElementsByName("delete-bar")[0];

	const jsonCollected = document.defaultView.localStorage.getItem(
		"selectedVideos",
		"[]",
	);
	const collected = JSON.parse(jsonCollected);

	if (enableDeletion) {
		for (const shortUUID of collected) {
			await deleteVideo(shortUUID, progress, deleteBar);
		}
	} else {
		addProgressRow(progress, "Deletion disabled in plugin settings.");
	}

	deleteUnviewed.disabled = true;
}
