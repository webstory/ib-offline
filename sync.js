'use strict'

const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const axios = require('axios')

const credential = JSON.parse(fs.readFileSync('data/credential.json', 'utf-8'))

let sid = ''
let user_id = 0
const siteUrl = 'https://inkbunny.net'

const dataDir = './data'

function delay(t) {
  return new Promise(done => {
    setTimeout(() => { done() }, t)
  })
}

async function download(url, path, options) {
  // axios image download with response type "stream"
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: options.headers
  })

  // pipe the result stream into a file on disc
  response.data.pipe(fs.createWriteStream(path))

  // return a promise and resolve when download finishes
  return new Promise((resolve, reject) => {
    response.data.on('end', () => {
      resolve()
    })

    response.data.on('error', () => {
      reject()
    })
  })
}

async function getSubmission(submission_id) {
  let submission = {}
  while(true) {
    let res = await axios.get(siteUrl + '/api_submissions.php', {
      headers: {},
      params: {
        sid: sid,
        submission_ids: submission_id,
        output_mode: 'json',
        sort_keywords_by: 'alphabetical',
        show_description: 'yes',
        show_description_bbcode_parsed: 'yes',
        show_writing: 'yes',
        show_writing_bbcode_parsed: 'yes',
        show_pools: 'yes'
      }
    })

    if(res.status != 200) {
      await delay(60000)
      continue
    } else {
      submission = _.get(res.data, 'submissions[0]', {})
      break
    }
  }

  let artist = submission.username

  if(!fs.existsSync(path.join(dataDir, artist))) {
    fs.mkdirSync(path.join(dataDir, artist))
    fs.writeFileSync(path.join(dataDir, artist,'index.json'), JSON.stringify({ submissions: {} }, null, 2))
  }

  let usermeta = JSON.parse(fs.readFileSync(path.join(dataDir, artist, 'index.json')).toString())
  usermeta.submissions[submission.submission_id] = submission
  fs.writeFileSync(path.join(dataDir, artist, 'index.json'), JSON.stringify(usermeta, null, 2))

  if(typeof(submission.files) != typeof([])) {
    console.error(typeof(submission.files))
    return false
  }
  let urls = submission.files.map((f) => f.file_url_full)

  for(let url of urls) {
    let filename = url.substr(url.lastIndexOf('/') + 1)

    // Download only local file not exists
    if(!fs.existsSync(path.join(dataDir, artist, filename))) {
      let retry = 10
      while(retry > 0) {
        try {
          await download(encodeURI(url), path.join(dataDir, artist, filename), {})
          console.log({artist, filename})
          break
        } catch(e) {
          retry--;
          console.error('Cannot find: '+encodeURI(url))
          await delay(10000)
        }
      }
    } else {
      return true
    }
  }

  return false
}


;(async () => {
  let token = await axios.get(siteUrl + '/api_login.php', {
    headers: {},
    params: {
      username: credential.username,
      password: credential.password,
      output_mode: 'json'
    }
  })

  if(token.status == 200) {
    sid = token.data.sid
    user_id = token.data.user_id

    // console.log({sid, user_id})
  } else {
    console.error(token.data)
    return
  }

  // Fetch the first page(mode 1)
  let favList = await axios.get(siteUrl + '/api_search.php', {
    headers: {},
    params: {
      sid: sid,
      get_rid: 'yes',
      output_mode: 'json',
      submission_ids_only: 'yes',
      submissions_per_page: 100,
      favs_user_id: user_id,
      orderby: 'fav_datetime'
    }
  })

  let page = 0
  let rid = null
  let latest_submission_id = 0
  let last_submission_id = 0
  let dupCount = 100
  try {
    last_submission_id = parseInt(fs.readFileSync(path.join(dataDir, 'last_submission_id.txt')).toString())
    console.log("Fetch from " + last_submission_id)
  } catch(e) {
    // Do nothing
  }

  if(favList.status == 200) {
    page = favList.data.page // Usually 1
    rid = favList.data.rid
    latest_submission_id = _.get(favList, "data.submissions[0].submission_id", 0)

    for(let s of favList.data.submissions) {
      await getSubmission(s.submission_id)
    }
  }

  page++
  while(true) {
    await delay(1000)

    // Countinuous search(mode 2)
    favList = await axios.get(siteUrl + '/api_search.php', {
      headers: {},
      params: {
        sid: sid,
        rid: rid,
        output_mode: 'json',
        submission_ids_only: 'yes',
        submissions_per_page: 100,
        favs_user_id: user_id,
        page: page
      }
    })

    if(favList.status != 200) {
      await delay(5000)
      continue
    }

    let submissions = _.get(favList.data, "submissions", [])

    for(let s of submissions) {
      let res = await getSubmission(s.submission_id)

      if(res) {
        dupCount--;
      } else {
        dupCount = 100
      }

      if(dupCount < 0) {
        console.log("Latest submission " + latest_submission_id)
        fs.writeFileSync(path.join(dataDir, 'last_submission_id.txt'), latest_submission_id)
        return
      }
    }

    page++
  }
})();