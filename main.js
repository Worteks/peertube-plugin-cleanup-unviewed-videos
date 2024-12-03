async function register({ registerSetting, settingsManager }) {
	registerSetting({
		name: "enable-deletion",
		label: "Enable deletion",
		type: "input-checkbox",
		descriptionHTML: "Enable Deletion",
		private: false,
	});

	registerSetting({
		name: "default-years",
		label: "Default years",
		type: "input",
		private: false,
	});

	settingsManager.onSettingsChange((settings) => {
		console.log("settings change", settings);
	});
}

async function unregister() {
	return;
}

module.exports = {
	register,
	unregister,
};
