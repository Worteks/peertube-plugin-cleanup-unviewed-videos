async function register({
	getRouter,
	peertubeHelpers,
	registerSetting,
	settingsManager
}) {
	registerSetting({
		name: "enable-deletion",
		label: "Enable deletion",
		type: "input-checkbox",
		descriptionHTML: "When this disabled, videos won't be actually deleted.",
		private: false,
	});

	registerSetting({
		name: "default-years-old",
		label: "Years",
		type: "input",
		default: 3,
		descriptionHTML: "Default value for search form.",
		private: false,
	});

	registerSetting({
		name: "default-months-old",
		label: "Months",
		type: "input",
		default: 0,
		descriptionHTML: "Default value for search form.",
		private: false,
	});

	registerSetting({
		name: "default-days-old",
		label: "Days",
		type: "input",
		default: 0,
		descriptionHTML: "Default value for search form.",
		private: false,
	});

	const database = peertubeHelpers.database;
	const logger = peertubeHelpers.logger;
	const router = getRouter();
	const videos = peertubeHelpers.videos;

	router.get("/", async (req, res) => {
		const user = await peertubeHelpers.user.getAuthUser(res);
		if (user) {
			const [years, months, days] = await Promise.all(
				["years", "months", "days"].map(async (field) => {
					const req_value = parseInt(req.query[field], 10);
					return !isNaN(req_value) ? req_value : parseInt(
						`${await settingsManager.getSetting(`default-${field}-old`)}`, 10);
				}),
			);

			logger.debug("peertube-plugin-manage-unviewed GET /", {
				years,
				months,
				days,
			});

			const [results, _] = await database.query(
				`SELECT "videoId" as id, name, url, "createdAt"
				FROM (
					SELECT "videoId", video.name, video.url, video."createdAt", MAX("endDate") AS last_viewed
						FROM "videoView"
						LEFT JOIN video ON "videoId" = video.id
						GROUP BY "videoId", video.name, video.url, video."createdAt"
				)
				WHERE last_viewed < CURRENT_DATE
					- interval \'${parseInt(years, 10)} years\'
					- interval \'${parseInt(months, 10)} months\'
					- interval \'${parseInt(days, 10)} days\'
			`,
			);
			const data = await Promise.all(
				results.map(async (r) => {
					const files = await videos.getFiles(r.id);
					return {
						...r,
						previewPath: files?.thumbnails?.length ? files.thumbnails[0].url : undefined,
					};
				}),
			);
			res.status(200).json(data);
		} else {
			res.status(403).json();
		}
	});

	router.delete("/:id", async (req, res) => {
		const user = await peertubeHelpers.user.getAuthUser(res);
		if (user) {
			logger.info(`peertube-plugin-manage-unviewed DELETE ${req.params.id}`);
			const enable_deletion = await settingsManager.getSetting("enable-deletion");
			if (enable_deletion) {
				await videos.removeVideo(req.params.id);
			} else {
				logger.info("peertube-plugin-manage-unviewed deletion is disabled");
			}
			res.status(204).json();
		} else {
			res.status(403).json();
		}
	});
}

async function unregister() {
	return;
}

module.exports = {
	register,
	unregister,
};
