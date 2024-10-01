

// what to include actualy to get UserRole constants ?
// import { UserRole } from '@peertube/peertube-models'

var defaultYears = 10

function register ({ registerHook, registerSettingsScript, registerClientRoute, peertubeHelpers, settingsManager}) {
   
  registerHook({
    target: 'action:application.init',
    handler: () => onApplicationInit(peertubeHelpers)
  })

  registerHook({
    target: 'action:auth-user.information-loaded',
      handler: ({ user }) => {
//          if ( user.role.id == UserRole.ADMINISTRATOR )
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

  registerHook({
    target: 'action:router.navigation-end',
    handler: params => console.log('New URL! %s.', params.path)
  })

  // Modal hooks

  // Settings

  registerSettingsScript({
      isSettingHidden: options => {

          console.log(options)
          
      if (options.setting.name === 'my-markdown-area' && options.formValues.select === '2') {
        return true
      }

      return false
    }
  })

  // Routes

    function submitHandler(event) {
        event.preventDefault();
        console.log('LISTENER')
        validateFormOnSubmit(event)

    }

    function validateFormOnSubmit(event) {
        console.log(document.body.classList);
        document.body.classList.add('video-deletion-running')
        console.log('validate form on submit')
        console.log(event)
        console.log(event.target.elements[0].value)
        console.log('' + document.defaultView.localStorage.getItem("access_token"))

        getLocalVideosList()
    }

    
  registerClientRoute({
    route: 'manage-unviewed/route',
      onMount: ({ rootEl }) => {

          peertubeHelpers.getSettings()
              .then(s => {
                  console.log(s)
                  defaultYears=s['default-years']
              })

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

          form.innerHTML='<div>number of years ago</div><input type="number" name="number-of-years-ago" value="' + defaultYears + '"><br><input type="submit" value="Delete"></div>';
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
    }
  })

  registerClientRoute({
    route: 'manage-unviewed/route/delete',
      onMount: ({ rootEl }) => {
          console.log('' . localStorage.getItem("access_token"))
    }
  })

  // WebSocket

  const baseScheme = window.location.protocol === 'https:'
    ? 'wss:'
    : 'ws:'

  const socket = new WebSocket(baseScheme + '//' + window.location.host + peertubeHelpers.getBaseWebSocketRoute() + '/toto');

  socket.addEventListener('message', (event) => {
    console.log(event.data)
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

function onApplicationInit (peertubeHelpers) {
  console.log('Mnaage Unviewed')

  const baseStaticUrl = peertubeHelpers.getBaseStaticRoute()
  const imageUrl = baseStaticUrl + '/images/chocobo.png'

  const topLeftBlock = document.querySelector('.top-left-block')

  topLeftBlock.style.backgroundImage = 'url(' + imageUrl + ')'

  peertubeHelpers.translate('User name')
   .then(translation => console.log('Translated User name by ' + translation))

  peertubeHelpers.getServerConfig()
    .then(config => console.log('Got server config.', config))
}

async function getViews(shortUUID,startDate,endDate,progress,deleteBar) {
    const access_token = document.defaultView.localStorage.getItem("access_token");
    const url = '/api/v1/videos/' + shortUUID + '/stats/overall?startDate=' + startDate.toISOString() + '&endDate=' + endDate.toISOString()

    // default to no deletion
    var totalWatchTime=1
    var totalViewers=1

    var deleted = deleteBar.getAttribute('value');
    deleteBar.setAttribute('value',deleted+1)
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
        console.log(json);
        totalWatchTime=json.totalWatchTime;
        totalViewers=json.totalViewers;
        if (( totalWatchTime == 0 ) && ( totalViewers == 0 )) {
            const text='delete video ' + shortUUID + ' !!'
            addProgressRow(progress,text);
            console.log(text);
        }
        else {
            const text='skip Video ' + shortUUID + 'since totalWatchTime=' + totalWatchTime  + ' totalViewers=' + totalViewers;
            addProgressRow(progress,text);
            console.log(text);
        }
    } catch (error) {
        console.error(error.message);
    }
}

async function getLocalVideosList() {
    const access_token = document.defaultView.localStorage.getItem("access_token");

    var start=0
    // for test only, set it to ~ 40
    var count=1
    var total=1
    const numberOfYearsAgoInput=document.getElementsByName('number-of-years-ago')[0];
    const numberOfYearsAgo=numberOfYearsAgoInput.value
    console.log(numberOfYearsAgo)

    const progressBar=document.getElementsByName('progress-bar')[0];
    const progress=document.getElementsByName('progress')[0];

    if ( numberOfYearsAgo > 0 )
    {
        const currentDate=new Date();
        var startDate=new Date();
        // FIXME for test only : in days !
        startDate.setDate(currentDate.getDate() - ( numberOfYearsAgo ));
        addProgressRow(progress,'WARNING TEST ONLY in DAYS !!!')
        // startDate.setDate(currentDate.getDate() - ( numberOfYearsAgo * 365 ));
        const startDateSinceEpoch=(startDate.getTime() / 1000);
        var endDate=currentDate;
        var jsonVideo={}
        var toDelete=new Array();
        addProgressRow(progress,'Collect all videos start date for deletion ' + startDate)
        try {
            while ( start < total )
            {
                const url = '/api/v1/videos?isLocal=true&start=' + start + '&count=' + count;    

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
                console.log(json);
                var total=json.total;
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
                            console.log(text)
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

        const deleteBar=document.getElementsByName('delete-bar')[0];
        const toDeleteLength = toDelete.length
        deleteBar.setAttribute('max',0);
        deleteBar.setAttribute('value',0);
        if ( toDeleteLength > 0 ) {
            deleteBar.setAttribute('max',toDeleteLength - 1);
            addProgressRow(progress, 'checking ' + toDeleteLength + ' videos.');
            toDelete.forEach( (jsonVideo) =>  {
                var shortUUID=jsonVideo.shortUUID;
                console.log(shortUUID);
                getViews(shortUUID,startDate,endDate,progress,deleteBar);
            })
        }
        else {
            deleteBar.setAttribute('max',0);
            addProgressRow(progress, 'no video published before deletion period.');
            addProgressRow(progress, 'local task compteted.');
        }

    }
    else {
        addProgressRow(progress,'number of years invalid')
    }        

}

