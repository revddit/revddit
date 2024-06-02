import {
  queryUserPageCombined,
  usernameAvailable,
  getModeratedSubreddits,
  getUserAbout,
  www_reddit,
  OVERVIEW, SUBMITTED, COMMENTS, GILDED,
} from 'api/reddit'
import { getMissingComments, getUserStatus } from 'api/reveddit'
import {
  getCommentsByID, getPostsByID,
  post_fields_for_user_page_lookup,
  comment_fields_for_user_page_lookup,
} from 'api/pushshift'
import { REMOVAL_META, AUTOMOD_REMOVED, AUTOMOD_REMOVED_MOD_APPROVED,
         MOD_OR_AUTOMOD_REMOVED, UNKNOWN_REMOVED, NOT_REMOVED, ANTI_EVIL_REMOVED,
         NO_LABEL, AUTOMOD_LATENCY_THRESHOLD
} from 'pages/common/RemovedBy'
import {
  itemIsRemovedOrDeleted,
  isComment, isPost, SimpleURLSearchParams, commentIsRemoved,
} from 'utils'
import { setPostAndParentDataForComments } from 'data_processing/info'
import { setMissingCommentMeta } from 'data_processing/missing_comments'

function lookupAndSetRemovedBy(global) {
  const comment_ids = []
  const post_ids = []
  const comments_removedBy_undefined = []
  const posts_removedBy_undefined = []
  const gs = global.state
  gs.items.forEach(item => {
    if (item.removedby === undefined && ! item.unknown) {
      if (isComment(item)) {
        comments_removedBy_undefined.push(item)
        comment_ids.push(item.id)
      } else if (isPost(item)) {
        posts_removedBy_undefined.push(item)
        post_ids.push(item.id)
      }
    }
  })
  let comments_promise = Promise.resolve()
  if (comments_removedBy_undefined.length) {
      comments_promise = getCommentsByID({ids: comment_ids, fields: comment_fields_for_user_page_lookup}).then(ps_comments => {
        setRemovedBy(comments_removedBy_undefined, ps_comments)
      })
  }
  let posts_promise = Promise.resolve()
  if (posts_removedBy_undefined.length) {
      posts_promise = getPostsByID({ids: post_ids, fields: post_fields_for_user_page_lookup}).then(ps_posts => {
        setRemovedBy(posts_removedBy_undefined, ps_posts)
      })
  }

  return Promise.all([comments_promise, posts_promise])
}

// this can handle posts or comments but not both together
// should change ps_autoremoved_map key if want to do both at same time
// - the fix: check for existence of a field that's always existed in one
//      but not the other, e.g. link_id is in all PS comments and not in submissions
function setRemovedBy(items_removedBy_undefined, ps_items) {
  items_removedBy_undefined.forEach(item => {
    const ps_item = ps_items[item.id]
    if (ps_item) {
      const retrievalLatency = ps_item.retrieved_on-ps_item.created_utc
      const archiveRemoved = itemIsRemovedOrDeleted(ps_item, false)
      if (ps_item.author_flair_text) {
        item.author_flair_text = ps_item.author_flair_text
      }
      if (item.removed) {
        if (archiveRemoved) {
          if (retrievalLatency <= AUTOMOD_LATENCY_THRESHOLD) {
            item.removedby = AUTOMOD_REMOVED
          } else {
            item.removedby = UNKNOWN_REMOVED
          }
        } else {
          // when archive item is not removed, it's less likely to have been auto-removed.
          // so, regardless of retrieval latency, can mark as mod removed
          item.removedby = MOD_OR_AUTOMOD_REMOVED
        }
      } else if (archiveRemoved) {
        item.removedby = AUTOMOD_REMOVED_MOD_APPROVED
      } else {
        item.removedby = NOT_REMOVED
      }
    } else if (item.removed) {
      item.removedby = UNKNOWN_REMOVED
    } else {
      item.removedby = NOT_REMOVED
    }
    if (item.removal_reason && isComment(item) && ! item.rev_mod_removed) {
      // Reset the status for comments only removed by Reddit (that is, not also removed by moderators)
      // Easier to overwrite this value here than modify above code.
      item.removedby = NO_LABEL
    }
  })
}
const blankMissingComments = {comments: {}}
let missing_comments_promise = Promise.resolve(blankMissingComments)

const acceptable_kinds = [OVERVIEW, COMMENTS, SUBMITTED, GILDED, '']
const acceptable_sorts = ['new', 'top', 'controversial', 'hot']

//isFirstTimeLoading is true on page load, false when: 'load all' or 'view more' is clicked
//  scrolling to load more is handled by calling getItems directly, so isFirstTimeLoading
//  becomes irrelevant and incorrect there
export const getRevdditUserItems = async (user, kind, global, isFirstTimeLoading = true) => {
  const gs = global.state
  let {sort, before, after, t, limit, all} = gs
  if (all) {
    limit = 100
  }
  const pathParts = window.location.pathname.split('/')
  const badKind = ! acceptable_kinds.includes(kind)
  const badSort = ! acceptable_sorts.includes(sort)
  const badPath = pathParts.length > 5
  if (badKind || badSort || badPath) {
    let path = pathParts.slice(0,4).join('/')
    const params = new SimpleURLSearchParams(window.location.search)
    if (badKind) {
      kind = ''
      path = pathParts.slice(0,3).join('/')
    }
    if (badSort) {
      params.delete('sort')
      sort = 'new'
    }
    if (path.slice(-1) !== '/') {
      path += '/'
    }
    window.history.replaceState(null,null,path+params.toString()+window.location.hash)
  }
  // only request missing comments once. this will always resolve immediately
  await missing_comments_promise.then(({comments}) => {
    if (Object.keys(comments).length === 0) {
      missing_comments_promise = getMissingComments({limit: 200})
      .catch(() => {
        return blankMissingComments
      })
    }
  })
  if (isFirstTimeLoading) {
    const moderated_promise = getModeratedSubreddits(user)
    const about_promise = getUserAbout(user)
    Promise.all([moderated_promise, about_promise])
    .then(([moderated_subreddits, user_about]) =>
       global.setState({moderated_subreddits, user_about}))
    .catch(() => {})
  }
  const params_pre_after = [user, kind, global, sort, before]
  const params_post_after = [t, limit, all]
  return getItems(...params_pre_after, after || gs.userNext, ...params_post_after)
  .then( async (pageLoad_or_loadAll_or_viewMore_userPageNext) => {
    window.onscroll = (ev) => {
      const {loading, userNext, show, error} = global.state
      if (userNext && ! loading && ! error && ! show && (window.innerHeight + window.pageYOffset) >= document.body.offsetHeight - 2) {
        global.setLoading('')
        .then(() => {
          getItems(...params_pre_after, userNext, ...params_post_after)
          .then(() => {
            const {userNext: updated_userNext, items} = global.state
            return global.setSuccess()
          })
        })
      }
    }
    const returnFunc = isFirstTimeLoading ? global.returnSuccess : global.setSuccess
    return returnFunc()
  })
}

const getItems = async (user, kind, global, sort, before = '', after = '', time, limit, all = false) => {
  const gs = global.state
  const {commentParentsAndPosts, userCommentsByPost} = gs
  let {oldestTimestamp, newestTimestamp} = gs
  let quarantined_subreddits
  if (gs.items.length) {
    const last = gs.items[gs.items.length - 1]
    if (last.quarantine) {
      quarantined_subreddits = last.subreddit
    }
  }
  const data = await queryUserPageCombined({user, kind, sort, before, after, t: time, limit, quarantined_subreddits})
  const userPageData = data.user
  if ('error' in data) {
    let user_issue_description
    if (data.error == 404) {
      const avail = await usernameAvailable(user)
      if (avail === true) {
        user_issue_description = 'does not exist'
      } else {
        const data = await getUserStatus(user)
        if (data.error || ! data.user_status) {
          console.error(data.error)
          user_issue_description = 'deleted_shadowbanned'
        } else {
          user_issue_description = data.user_status
        }
      }
    } else if (data?.message.toLowerCase() == 'forbidden') {
      user_issue_description = 'suspended'
    } else if (data?.message) {
      user_issue_description = 'ERROR: '+data.message
    }
    return global.setError({userIssueDescription: user_issue_description})
  }
  if (! userPageData) {
    return global.setError({userIssueDescription: 'ERROR: Too Many Requests'})
  }
  const {comments: missingComments} = await missing_comments_promise
  const num_pages = gs.num_pages+1
  const userPage_item_lookup = {}
  const ids = [], comments = []
  const items = gs.items

  userPageData.items.forEach((item, i) => {
    userPage_item_lookup[item.name] = item
    item.rev_position = items.length + i
    ids.push(item.name)
    if (item.removal_reason) {
      // Below ensures that posts removed only by admins do not receive a red background
      // Comments are marked in red so that the thread view and user profile view are consistent.
      if (isComment(item)) {
        item.removed = true
      }
      item.removedby_evil = ANTI_EVIL_REMOVED
    }
    if (! oldestTimestamp) {
      if (! item.stickied || ! userPageData.after) {
        oldestTimestamp = item.created_utc
      }
      newestTimestamp = item.created_utc
    } else if (item.created_utc > newestTimestamp) {
      newestTimestamp = item.created_utc
    } else if (item.created_utc < oldestTimestamp) {
      // item.stickied is never true here b/c stickied items appear first in the list
      oldestTimestamp = item.created_utc
    }
    if (isPost(item)) {
      item.selftext = ''
      // posts do not appear in redditInfoItems
      if (itemIsRemovedOrDeleted(item, false)) {
        item.removed = true
      }
    } else {
      comments.push(item)
      if (item.link_author === item.author) {
        item.is_op = true
      }
      if (item.id in missingComments) {
        setMissingCommentMeta(item, missingComments)
      }
      if (! userCommentsByPost[item.link_id]) {
        userCommentsByPost[item.link_id] = []
      }
      userCommentsByPost[item.link_id].push(item)
    }
    if (items.length > 0) {
      const prevItem = items[items.length-1]
      if (! prevItem.stickied) {
        item.prev = prevItem.name
      }
    }
    items.push(item)
  })
  // [...items] would be more clear here than slice() but it gives syntax error for some reason
  items.slice().reverse().forEach((item, index, array) => {
    if (index > 0) {
      item.next = array[index-1].name
    }
  })
  const redditInfoItems = data.info
  // posts do not appear in redditInfoItems
  Object.values(redditInfoItems).forEach(info_item => {
    const userPage_item = userPage_item_lookup[info_item.name]
    if (itemIsRemovedOrDeleted(info_item, false)) {
      userPage_item.removed = true
      if (isComment(info_item)) {
        userPage_item.rev_mod_removed = true
      }
    }
    userPage_item.collapsed = info_item.collapsed
  })
  const commentParentsAndPosts_new = data.parents
  Object.assign(commentParentsAndPosts, commentParentsAndPosts_new)
  setPostAndParentDataForComments(comments, commentParentsAndPosts)
  await global.setState({items, num_pages, userNext: userPageData.after,
    commentParentsAndPosts, oldestTimestamp, newestTimestamp
  })
  if (userPageData.after && all) {
    return getItems(user, kind, global, sort, '', userPageData.after, time, limit, all)
  }
  return userPageData.after
}
