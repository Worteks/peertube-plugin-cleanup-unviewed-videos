async function register({ registerSetting }) {
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
}

async function unregister() {
	return;
}

module.exports = {
	register,
	unregister,
};
