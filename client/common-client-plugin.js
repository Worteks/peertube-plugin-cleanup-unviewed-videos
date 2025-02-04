const register = (() => {
	const debug = false;
	const pagination_count = 100;

	let user_is_admin = false;

	// References to HTML elements
	let years_old_input,
		months_old_input,
		days_old_input,
		feedback_container,
		video_list,
		delete_button,
		checkboxes,
		progress;

	// Lock/unlock actual deletion
	let enable_deletion = false;

	// This will receive peertube helpers from register function
	let helpers;
	let settings;
	let access_token;

	/**
	 * Create UI
	 */
	async function create_form({ rootEl }) {
		if (!user_is_admin) window.location.href = "/";

		// Generate an ID prefix to avoid collisions
		const prefix = Math.floor(Math.random() * Date.now()).toString(36);

		await load_settings();

		rootEl.innerHTML = `
				<div class="cleanup-unviewed-videos-main">
					<h1>${await helpers.translate("Cleanup Unviewed Videos")}</h1>
					<form id="${prefix}-form" class="pt-two-cols mt-4">
						<div class="title-col">
							<h2>${await helpers.translate("Last view age")}</h2>
						</div>

						<div class="content-col">
							<div class="form-group">
								<label for="years_old">${await helpers.translate("Years")}</label>
								<input id="${prefix}-years-old-input" type="number" name="years_old" class="form-control" min="0" value="${settings["default-years-old"] ?? 3}">
							</div>
							<div class="form-group">
								<label for="months_old">${await helpers.translate("Months")}</label>
								<input id="${prefix}-months-old-input" type="number" name="months_old" class="form-control" min="0" value="${settings["default-months-old"] ?? 0}">
							</div>
							<div class="form-group">
								<label for="days_old">${await helpers.translate("Days")}</label>
								<input id="${prefix}-days-old-input" type="number" name="days_old" class="form-control" min="0" value="${settings["default-days-old"] ?? 0}">
							</div>
							<button type="submit" class="peertube-button orange-button">${await helpers.translate("Search")}</button>
						</div>
					</form>
					<div id="${prefix}-user-feedback" class="user-feedback"></div>

					<div class="video-list-container">
						<div class="button-container">
							<progress id="${prefix}-progress" style="visibility: hidden;"></progress>
							<button id="${prefix}-delete-button" class="peertube-button orange-button" style="visibility: hidden;">${await helpers.translate("Delete selected videos")}</button>
						</div>
						<ul id="${prefix}-video-list"></ul>
					</div>
				</div>
			`;

		// Handle form submit
		rootEl
			.getElementsByTagName("form")[0]
			.addEventListener("submit", (event) => {
				event.preventDefault();
				search_videos(
					parseInt(years_old_input.value, 10),
					parseInt(months_old_input.value, 10),
					parseInt(days_old_input.value, 10),
				);
			});

		// Store references to HTML elements
		years_old_input = document.getElementById(`${prefix}-years-old-input`);
		months_old_input = document.getElementById(`${prefix}-months-old-input`);
		days_old_input = document.getElementById(`${prefix}-days-old-input`);
		feedback_container = document.getElementById(`${prefix}-user-feedback`);
		video_list = document.getElementById(`${prefix}-video-list`);
		progress = document.getElementById(`${prefix}-progress`);

		delete_button = document.getElementById(`${prefix}-delete-button`);
		delete_button.addEventListener("click", (event) => {
			event.preventDefault();
			delete_selected_videos();
		});
	}

	/**
	 * Search for unseen videos having at least a given age
	 */
	async function search_videos(
		years_old,
		months_old,
		days_old,
		fake_empty_list = false,
	) {
		delete_button.style.visibility = "hidden";

		const ref_date = get_absolute_date_from_age(
			years_old,
			months_old,
			days_old,
		);

		display_user_feedback(
			`${await helpers.translate("Searching for videos unseen since")} ${ref_date.toLocaleString()}`,
			true,
		);

		// Eligible videos will be appended to this array
		const videos = [];

		// Loop though pages of raw search results (whatever the date)
		let page = 0;
		let has_more_data = true;
		while (has_more_data) {
			const json = await request_api(
				`/api/v1/videos?isLocal=true&privacyOneOf=1&privacyOneOf=4&privacyOneOf=3&privacyOneOf=2&privacyOneOf=5&start=${page++ * pagination_count}&count=${pagination_count}`,
			);
			has_more_data = json.data.length === pagination_count;

			for (const video of json.data) {
				if (
					new Date(video.updatedAt) <= ref_date && // If video was published after reference date, then were sure it won't match requirements
					(await get_video_view_count(video.shortUUID, ref_date)) === 0
				) {
					videos.push(video);
				}
			}
		}

		// Useful for simulating video post-deletion state when developing
		if (fake_empty_list) {
			videos.splice(0, videos.length);
		}

		if (debug) console.log("Eligible videos: ", videos);

		// Update video list
		video_list.innerHTML = "";
		checkboxes = [];
		videos.forEach((video) => {
			const element = document.createElement("li");
			element.innerHTML = `
					<label class="checkbox">
						<input type="checkbox" checked name="${video.shortUUID}">
						<span></span>
					</label>
					<a href="${video.url}" target="_blank">
						<img src="${video.previewPath}">
						<div class="info">
							<div class="video-name">${video.name}</div>
							<div class="date">${new Date(video.createdAt).toLocaleString()}</div>
						</div>
					</a>
				`;
			video_list.appendChild(element);
			checkboxes.push(element.getElementsByTagName("input")[0]);
		});
		delete_button.style.visibility = videos.length ? "visible" : "hidden";

		if (videos.length === 0) {
			display_user_feedback(
				await helpers.translate("No video match your search criteria."),
			);
		}
	}

	/**
	 * Trigger videos deletion
	 */
	async function delete_selected_videos() {
		const checked = checkboxes.filter((element) => element.checked);
		if (debug)
			console.log(
				"Videos selected for deletion: ",
				checked.map((element) => element.name),
			);

		progress.value = 0;
		progress.max = checked.length;
		progress.style.visibility = checked.length ? "visible" : "hidden";
		for (const input of checked) {
			const uuid = input.name;
			if (enable_deletion) {
				await request_api(`/api/v1/videos/${uuid}`, "DELETE");
			} else {
				console.log(`DELETE /api/v1/videos/${uuid}`);
				// Fake API delay
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
			progress.value++;
			input.parentElement.remove();
		}

		progress.style.visibility = "hidden";

		search_videos(
			parseInt(years_old_input.value, 10),
			parseInt(months_old_input.value, 10),
			parseInt(days_old_input.value, 10),
			true,
		);
	}

	/**
	 * Get view count for a video since a reference date
	 */
	async function get_video_view_count(uuid, ref_date) {
		const json = await request_api(
			`/api/v1/videos/${uuid}/stats/overall?startDate=${ref_date.toISOString()}`,
		);
		return json.totalViewers;
	}

	/**
	 * Give feedback to user
	 */
	function display_user_feedback(text, clear_first = false) {
		if (clear_first) feedback_container.innerHTML = "";
		feedback_container.innerHTML += `<div>${text}</div>`;
	}

	/**
	 * Load settings and access token
	 */
	async function load_settings() {
		settings = await helpers.getSettings();
		enable_deletion = settings["enable-deletion"];
		console.log(`deletion is ${enable_deletion ? "enabled" : "disabled"}`);

		access_token = document.defaultView.localStorage.getItem("access_token");
	}

	/**
	 * Make a request to PeerTube API
	 */
	async function request_api(url, method = "GET") {
		const response = await fetch(url, {
			method,
			headers: {
				Authorization: "Bearer " + access_token,
			},
		});
		if (!response.ok) {
			throw new Error(`Response status: ${response.status}`);
		}
		if (response.status !== 204) {
			const json = await response.json();
			if (debug) console.log(url, json);
			return json;
		}
	}

	/**
	 * Return a Date object corresponding to given age
	 */
	function get_absolute_date_from_age(years = 0, months = 0, days = 0) {
		const d = new Date();
		d.setFullYear(d.getFullYear() - years);
		d.setMonth(d.getMonth() - months);
		d.setDate(d.getDate() - days);
		return d;
	}

	/**
	 * Register our plugin
	 */
	return async ({ registerHook, registerClientRoute, peertubeHelpers }) => {
		helpers = peertubeHelpers;
		load_settings();

		/**
		 * Register hooks
		 */

		// Add our menu entry
		registerHook({
			target: "filter:left-menu.links.create.result",
			handler: async (menu_entries) => {
				return [
					{
						key: "cleanup-unviewed-videos",
						title: await helpers.translate("Cleanup"),
						links: [
							{
								path:
									helpers.getBasePluginClientPath() +
									"/cleanup-unviewed-videos",
								icon: "delete",
								shortLabel: await helpers.translate("Unviewed"),
								label: await helpers.translate("Unviewed"),
							},
						],
					},
				].concat(menu_entries);
			},
		});

		// Toggle menu visibility according to connected user role
		registerHook({
			target: "action:auth-user.information-loaded",
			handler: ({ user }) => {
				user_is_admin = user.role.id === 0; // 0 : UserRole.ADMINISTRATOR
				const i = setInterval(() => {
					if (document.querySelector(".cleanup-unviewed-videos.menu-block")) {
						document.querySelector(
							".cleanup-unviewed-videos.menu-block",
						).style.display = user_is_admin ? "inline-block" : "none";
						clearInterval(i);
					}
				}, 500);
			},
		});

		/**
		 * Register route
		 */
		registerClientRoute({
			route: "cleanup-unviewed-videos",
			onMount: create_form,
		});
	};
})();

export { register };
