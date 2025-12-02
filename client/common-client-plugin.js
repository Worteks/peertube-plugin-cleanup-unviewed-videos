const register = (() => {
	const debug = false;

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

		years_old |= 0;

		const ref_date = get_absolute_date_from_age(
			years_old,
			months_old,
			days_old,
		);

		display_user_feedback(
			`${await helpers.translate("Searching for videos unseen since")} ${ref_date.toLocaleString()}`,
			true,
		);

		// Get videos list
		const videos = await request_api(
			`/plugins/cleanup-unviewed-videos/router?years=${years_old}&months=${months_old}&days=${days_old}`);

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
			element.setAttribute("video-id", video.id);
			element.innerHTML = `
					<label class="checkbox">
						<input type="checkbox" checked video-id="${video.id}">
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
		const ids = checkboxes.filter((element) => element.checked).map((c) => parseInt(c.getAttribute("video-id"), 10));
		if (debug) console.log("Videos to delete", ids);

		progress.value = 0;
		progress.max = ids.length;
		progress.style.visibility = ids.length ? "visible" : "hidden";
		for (const id of ids) {
			await request_api(`/plugins/cleanup-unviewed-videos/router/${id}`, "DELETE");
			progress.value++;

			[...document.getElementsByTagName("li")].find((e) => parseInt(e.getAttribute("video-id"), 10) === id).remove();
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
				return menu_entries.concat([
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
				]);
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
						).style.display = user_is_admin ? "block" : "none";
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
			title: await helpers.translate("Cleanup Unviewed Videos"),
			onMount: create_form,
		});
	};
})();

export { register };
