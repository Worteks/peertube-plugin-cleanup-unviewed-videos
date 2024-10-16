const WebSocketServer = require('ws').WebSocketServer

async function register ({
  registerHook,
  getRouter,
  registerWebSocketRoute,
  registerSetting,
  settingsManager,
  storageManager,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  registerExternalAuth,
  peertubeHelpers
}) {

  registerSetting({
    name: 'enable-deletion',
    label: 'Enable deletion',
    type: 'input-checkbox',
    descriptionHTML: 'Enable Deletion'
  })

  registerSetting({
    name: 'default-years',
    label: 'Default years',
    type: 'input',
    private: false
  })

}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

