var defaultYears = 3
var enableDeletion = true

// Enable for testing only
const testForceSelectedVideos = false
const debugLog = false

function logdebug(info)
{
    if ( debugLog ) console.log(info);
}

async function register ({
    registerHook,
    registerSettingsScript,
    registerClientRoute,
    peertubeHelpers}) {

  registerHook({
    target: 'action:application.init',
    handler: () => onApplicationInit(peertubeHelpers)
  })

  registerHook({
    target: 'action:auth-user.information-loaded',
      handler: ({ user }) => {
//        0 : UserRole.ADMINISTRATOR
          if ( user.role.id == 0 )
          {
              document.body.classList.add('show-manage-unviewed')
          }
          else
          {
              document.body.classList.remove('show-manage-unviewed')
          }
      }
  })

  registerHook({
    target: 'filter:left-menu.links.create.result',
    handler: (result) => {
      return [
        {
          key: 'manage-unviewed',
          title: 'Manage Unviewed',
          links: [
            {
              path: peertubeHelpers.getBasePluginClientPath() + '/manage-unviewed/route',
              icon: '',
              shortLabel: 'Unviewed',
              label: 'Unviewed'
            }
          ]
        }
      ].concat(result)
    }
  })

  // Router hooks

  // Modal hooks

  // Settings

  registerSettingsScript({
      isSettingHidden: options => {

          logdebug(options)
          if (options.setting.name === 'my-markdown-area' && options.formValues.select === '2') {
              return true
          }
      return false
    }
  })

  // Routes

    function submitHandler(event) {
        event.preventDefault();
        logdebug('LISTENER')
        validateFormOnSubmit(event)

    }

    function validateFormOnSubmit(event) {
        logdebug(event)
        if ( event.submitter.name == 'select-unviewed' )
        {
            logdebug(document.body.classList);
            document.body.classList.add('video-deletion-running')
            logdebug('validate form on submit')

            logdebug(event.target.elements[0].value)
            logdebug('' + document.defaultView.localStorage.getItem("access_token"))

            selectVideos()
        }
        if ( event.submitter.name == 'delete-unviewed' ) {
            deleteSelectedVideos()
        }
    }

  registerClientRoute({
    route: 'manage-unviewed/route',
      onMount: ({ rootEl }) => {

          const div=document.createElement('div')
          div.setAttribute('class','right-form')
          const title=document.createElement('h1')
          title.append('Unviewed')
          const form=document.createElement('form')
          if (form.addEventListener) {
              form.addEventListener("submit", (event) => submitHandler(event), true);
          }
          else {
              form.attachEvent('onsubmit', (event) => submitHandler(event) );
          }
          form.action="validateFromOnSubmit()";
          form.innerHTML='<div>number of years ago</div><input type="number" name="number-of-years-ago" value="' + defaultYears + '"><br><input type="submit" name="select-unviewed" value="Select"><input type="submit" name="delete-unviewed" value="Delete"></div>';          
          div.appendChild(title);
          div.appendChild(form);
          const progressBar=document.createElement('progress');
          progressBar.setAttribute('name','progress-bar');
          progressBar.setAttribute('value',0);
          progressBar.setAttribute('max',100);
          const deleteBar=document.createElement('progress');
          deleteBar.setAttribute('name','delete-bar');
          deleteBar.setAttribute('value',0);
          deleteBar.setAttribute('max',100);
          const progress=document.createElement('table');
          progress.setAttribute('name','progress');
          div.appendChild(progressBar);
          div.appendChild(deleteBar);
          div.appendChild(progress);
          rootEl.appendChild(div)
          const deleteUnviewed=document.getElementsByName('delete-unviewed')[0];
          deleteUnviewed.hidden=!enableDeletion
          const jsonCollected=document.defaultView.localStorage.getItem("selectedVideos",'[]')
          const collected=JSON.parse(jsonCollected)
          if ( collected.length > 0  ) {
              addProgressRow(progress,'NOTE: ' + collected.length + ' videos are already selected for deletion in this browser')
          }
    }
  })

  registerClientRoute({
    route: 'manage-unviewed/route/delete',
      onMount: ({ rootEl }) => {
          logdebug('' . localStorage.getItem("access_token"))
    }
  })

}

export {
  register
}

function addProgressRow(progress,text) {
    const p = document.createElement('tr')
    p.append(text)
    progress.appendChild(p)
}

async function onApplicationInit (peertubeHelpers) {
  logdebug('Manage Unviewed')

  const baseStaticUrl = peertubeHelpers.getBaseStaticRoute()

  peertubeHelpers.getServerConfig()
        .then(config => logdebug('Got server config.', config))

    const settings = await peertubeHelpers.getSettings();
    logdebug('Settings ' + settings)
    enableDeletion=settings['enable-deletion']
    defaultYears=settings['default-years']
    logdebug('enableDeletion',enableDeletion)

}

async function deleteVideo(shortUUID,progress,deleteBar) {
    const url='/api/v1/videos/' + shortUUID
    const access_token = document.defaultView.localStorage.getItem("access_token");

    try {
        const response = await fetch(url,
                                     {
                                         method: 'DELETE',
                                         headers: {
                                             "Authorization": "Bearer " + access_token
                                         },
                                     });
        if (!response.ok) {
        addProgressRow(progress,'Error when calling deletion api ' + shortUUID + ' status ' + response.status )
            throw new Error(`Response status: ${response.status}`);
        }
        var deleted = deleteBar.getAttribute('value');
        deleteBar.setAttribute('value',deleted+1)
        const text='video deleted ' + shortUUID
        addProgressRow(progress,text);
        logdebug(text);
    } catch (error) {
        console.error(error.message);
    }

}

async function getViews(shortUUID,startDate,endDate,progress,deleteBar) {
    const access_token = document.defaultView.localStorage.getItem("access_token");
    const url = '/api/v1/videos/' + shortUUID + '/stats/overall?startDate=' + startDate.toISOString() + '&endDate=' + endDate.toISOString()

    // default to no deletion
    var totalWatchTime=1
    var totalViewers=1

    try {
        const response = await fetch(url,
                                     {
                                         headers: {
                                             "Authorization": "Bearer " + access_token
                                         },
                                     });
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const json = await response.json();
        logdebug(json);
        totalWatchTime=json.totalWatchTime;
        totalViewers=json.totalViewers;
        if (( totalWatchTime == 0 ) && ( totalViewers == 0 )) {
            const text='select video for deletion ' + shortUUID
            addProgressRow(progress,text)
            logdebug(text)
            return true;
        }
        else {
            const text='skip Video ' + shortUUID + ' since totalWatchTime=' + totalWatchTime  + ' totalViewers=' + totalViewers;
            addProgressRow(progress,text);
            logdebug(text);
            return false;
        }
    } catch (error) {
        console.error(error.message);
    }
    return false;
}

async function selectForDeletion(videos,startDate,endDate,progress,deleteBar) {
    var collected=new Array()
    const addviewed = async function (jsonVideo) {
        var shortUUID=jsonVideo.shortUUID;
        logdebug(shortUUID);
        const keep = await getViews(shortUUID,startDate,endDate,progress,deleteBar)
        if ( keep )
        {
            collected.push(shortUUID)
            logdebug('collected',collected)
        }
    }
    // can't use forEach on async function
    // videos.forEach(addviewed)
    for (const viewed of videos) {
        await addviewed(viewed)
    }
    logdebug(collected);
    var jsonCollected=JSON.stringify(collected)
    logdebug(jsonCollected)

    return collected;
}

async function selectVideos() {
    const access_token = document.defaultView.localStorage.getItem("access_token");

    var start=0
    var count=100
    var total=1
    const numberOfYearsAgoInput=document.getElementsByName('number-of-years-ago')[0];
    const numberOfYearsAgo=numberOfYearsAgoInput.value
    logdebug(numberOfYearsAgo)

    const progressBar=document.getElementsByName('progress-bar')[0];
    const progress=document.getElementsByName('progress')[0];
    const deleteUnviewed=document.getElementsByName('delete-unviewed')[0];

    deleteUnviewed.hidden=!enableDeletion;

    // reset stored videos and cleanup textarea
    {
        progress.replaceChildren()
        const jsonCollected=document.defaultView.localStorage.getItem("selectedVideos",'[]')
    }

    if ( numberOfYearsAgo > 0 )
    {
        deleteUnviewed.disabled=true;
        const currentDate=new Date();
        var startDate=new Date();
        startDate.setDate(currentDate.getDate() - ( numberOfYearsAgo * 365 ));
        const startDateSinceEpoch=(startDate.getTime() / 1000);
        var endDate=currentDate;
        var jsonVideo={}
        var toDelete=new Array();
        addProgressRow(progress,'Collect all videos start date for deletion ' + startDate)
        try {
            while ( start < total )
            {
                const url = '/api/v1/videos?isLocal=true&privacyOneOf=1&privacyOneOf=4&privacyOneOf=3&privacyOneOf=2&privacyOneOf=5&start=' + start + '&count=' + count;

                const response = await fetch(url,
                                             {
                                                 headers: {
                                                     "Authorization": "Bearer " + access_token
                                                 },
                                             });
                if (!response.ok) {
                    throw new Error(`Response status: ${response.status}`);
                }
                const json = await response.json();
                logdebug(json);
                total=json.total;
                var pos=start;
                if ( total > 0 )
                {
                    progressBar.setAttribute('max',total-1);
                    for ( pos=start; ( pos < ( start + count )) && ( pos < total ); pos ++ )
                    {
                        progressBar.setAttribute('value',pos);
                        var jsonVideo=json.data[pos-start]
                        var shortUUID=jsonVideo.shortUUID;
                        var publishedAt=jsonVideo.publishedAt;
                        var publishedAtSinceEpoch=new Date(publishedAt).getTime() / 1000;
                        if ( publishedAtSinceEpoch > startDateSinceEpoch )
                        {
                            const text ='should skip video' + pos + ' ' + shortUUID + ' publishedAt ' + publishedAt + ' after deletion period'
                            logdebug(text)
                        }
                        else {
                            toDelete.push(jsonVideo);
                        }
                    }
                }
                start=pos
            }
        } catch (error) {
            console.error(error.message);
        }

        if ( testForceSelectedVideos ) {
            // TEST ONLY
            logdebug("WARNING TEST testForceSelectedVideos")
            toDelete=['ahahah','lfkjqdslfkj','lkdjsKL']
        }

        const deleteBar=document.getElementsByName('delete-bar')[0];
        const toDeleteLength = toDelete.length
        deleteBar.setAttribute('max',0);
        deleteBar.setAttribute('value',0);
        if ( toDeleteLength > 0 ) {
            deleteBar.setAttribute('max',toDeleteLength);
            addProgressRow(progress, 'checking ' + toDeleteLength + ' videos.')
            var collected = [];
            if ( testForceSelectedVideos ) {
                // TEST ONLY
                logdebug("WARNING TEST")
                collected=['ahahah','lfkjqdslfkj','lkdjsKL']
            }
            else {
                collected=await selectForDeletion(toDelete,startDate,endDate,progress,deleteBar)
            }
            const jsonCollected=JSON.stringify(collected)
            logdebug(jsonCollected)
            // save collectecd into local storage
            document.defaultView.localStorage.setItem("selectedVideos",jsonCollected)
            deleteUnviewed.disabled=false;
        }
        else {
            deleteBar.setAttribute('max',0);
            addProgressRow(progress, 'no video published before deletion period.');
            addProgressRow(progress, 'local task compteted.');

            deleteUnviewed.disabled=true;
            document.defaultView.localStorage.setItem("selectedVideos",'[]')
        }

    }
    else {
        addProgressRow(progress,'number of years invalid')
    }
}

async function deleteSelectedVideos()
{
    const progress=document.getElementsByName('progress')[0];
    const deleteUnviewed=document.getElementsByName('delete-unviewed')[0];
    const deleteBar=document.getElementsByName('delete-bar')[0];

    const jsonCollected=document.defaultView.localStorage.getItem("selectedVideos",'[]')
    const collected=JSON.parse(jsonCollected)

    if ( enableDeletion ) {
        for (const shortUUID of collected) {
            await deleteVideo(shortUUID,progress,deleteBar)
        }
    }
    else {
        addProgressRow(progress, 'Deletion disabled in plugin settings.')
    }

    deleteUnviewed.disabled=true;
}
