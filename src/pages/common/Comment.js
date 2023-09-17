import React, {useState} from 'react'
import { prettyScore,
         PATH_STR_USER, PATH_STR_SUB, convertPathSub, stripRedditLikeDomain,
} from 'utils'
import Time from 'pages/common/Time'
import RemovedBy, {QuarantinedLabel} from 'pages/common/RemovedBy'
import { ORPHANED } from 'pages/common/RemovedBy'
import CommentBody from 'pages/common/CommentBody'
import Author from 'pages/common/Author'
import { connect, hasClickedRemovedUserCommentContext, urlParamKeys } from 'state'
import {AddUserParam} from 'data_processing/RestoreComment'
import {MessageMods} from 'components/Misc'
import { NewWindowLink } from 'components/Misc'
import Flair from './Flair'
import SubscribersCount from './SubscribersCount'

const Comment = (props) => {
  const [displayBody, setDisplayBody] = useState(true)
  const {t, sort, userCommentsByPost, after: after_gs, before: before_gs} = props.global.state
  const {author, name, created_utc, locked, link_id, subreddit, score, permalink, //from reddit comment data
         quarantine, url, num_comments, //from reddit post data
         link_title, link_author, //from reddit post data, renamed
         removed, deleted, is_op, num_replies, //from reveddit post processing
         rev_position, //from reveddit post processing
         parent_context, parent_removed_label, post_removed_label, link_permalink, //from reveddit post processing
         kind, page_type, //from parent component
        } = props
  let {prev, next} = props // from reveddit post processing
  let classNames = ['comment', 'user']
  let submitter = ''
  if (is_op) {
    submitter = ' submitter'+' '
  }
  if (removed) {
    classNames.push('removed')
  } else if (deleted) {
    classNames.push('deleted')
  } else {
    classNames.push('comment-even')
  }
  let quarantined_subreddits
  if (quarantine) {
    classNames.push('quarantine')
    quarantined_subreddits = subreddit
  }
  locked && classNames.push('locked')

  let directlink = ''
  let after_before = '', after = '', before = ''
  let add_user = ''
  if (! prev && after_gs) {
    prev = after_gs
  }
  if (! next && before_gs) {
    next = before_gs
  }
  if (prev) {
    after_before = `after=${prev}&`
    after = prev
  } else if (next) {
    after_before = `before=${next}&`
    before = next
  }
  // after_before only has a value for user pages
  if (after_before) {
    directlink = '?'+after_before+`limit=1&sort=${sort}&show=${name}&removal_status=all`
    add_user = getAddUserParamString({
      rev_position,
      author,
      userCommentsByPost,
      link_id,
      quarantined_subreddits,
      kind, sort, t, next, prev})
  }
  let post_parent_removed = []
  if (parent_removed_label) {
    post_parent_removed.push('parent '+parent_removed_label)
  }
  if (post_removed_label) {
    post_parent_removed.push('link '+post_removed_label)
  }
  const rev_subreddit = PATH_STR_SUB+'/'+subreddit
  let rev_link_permalink = '', rev_link_permalink_with_add_user = ''
  if (link_permalink) {
    rev_link_permalink = convertPathSub(link_permalink.replace(/^https:\/\/[^/]*/,''))
    rev_link_permalink_with_add_user = rev_link_permalink + '?' + add_user
  }
  const focusAuthorParam = urlParamKeys.categoryFilter_author+'='+author
  const contextParamStr = ['context=3',...(add_user && [add_user])].join('&')
  return (
    <div id={name} className={classNames.join(' ')} data-fullname={name} data-created_utc={created_utc}>
      <div className='comment-head'>
        <a onClick={() => setDisplayBody(! displayBody)} className='collapseToggle spaceRight'>{displayBody ? '[–]' : '[+]'}</a>
        <Flair className='link-flair' field='link_flair_text' globalVarName='post_flair' {...props} />
        <a href={url ? stripRedditLikeDomain(url) : rev_link_permalink} className='title'
          >{link_title}</a>
        {'link_author' in props &&
          <>
            <span> by </span>
            <a
              href={`${PATH_STR_USER}/${link_author}`}
              className='author'>
              {link_author}
            </a>
          </>
        }
        {'subreddit' in props &&
          <>
            <span> in </span>
            <a
              href={rev_subreddit+'/'}
              className='subreddit-link subreddit'
              data-subreddit={subreddit}
            >
              {`/r/${subreddit}`}
            </a> <SubscribersCount {...props}/>
          </>
        }
      </div>
      <div className='comment-head subhead'>
        <Author {...props} className='spaceRight'/>
        <span className='comment-score spaceRight'>{prettyScore(score)} point{(score !== 1) && 's'}</span>
        <Time {...props}/>
        <div>
          <RemovedBy style={{display:'inline', marginRight: '5px'}} {...props} />
          {post_parent_removed.length !== 0 &&
            <RemovedBy removedby={ORPHANED} orphaned_label={post_parent_removed.join(', ')} style={{display:'inline'}}/>
          }
        </div>
      </div>
      <div className='comment-body-and-links' style={displayBody ? {} : {display: 'none'}}>
        <CommentBody {...props}/>
        <div className='comment-links'>
          { ! deleted &&
            <>
              <QuarantinedLabel {...props}/>
              { parent_context ?
                <>
                  <a href={parent_context+'?removedby=missing'}>reveddit-parent</a>
                  <NewWindowLink reddit={parent_context+'?limit=500'} redesign={true}>reddit-parent</NewWindowLink>
                  <NewWindowLink reddit={'/api/info?id='+name}>reddit-permalink</NewWindowLink>
                </>
                :
                  <a href={permalink+'?'+contextParamStr+'#'+name}
                     onClick={(removed && add_user) ? hasClickedRemovedUserCommentContext: null}
                  >context{num_replies && `(${num_replies})`}</a>
              }
              {rev_link_permalink &&
                <>
                  <a href={rev_link_permalink_with_add_user}>full comments
                    {'num_comments' in props && `(${num_comments})`}</a>
                  <a href={rev_link_permalink_with_add_user+'&'+focusAuthorParam}>full comments(author)</a>
                </>
              }
              <NewWindowLink old={true} reddit={permalink+'?context=3'}>reddit</NewWindowLink>
              { directlink && <a href={directlink}>directlink</a>}
              { ! parent_context &&
                <MessageMods {...props}/>
              }
            </>
          }
        </div>
      </div>
    </div>
  )

}

export const getAddUserParamString = (
  {rev_position, author, userCommentsByPost, link_id,
   kind, sort, t, next, prev, quarantined_subreddits}) => {
  const addUserParam = new AddUserParam()
  const samePost_comments = userCommentsByPost[link_id] || []
  const samePost_lastComment = samePost_comments[samePost_comments.length -1] || {}
  const samePost_firstComment = samePost_comments[0] || {}
  const addUser_afterBefore = {}
  if (samePost_lastComment.rev_position - rev_position < 100 && samePost_lastComment.next) {
    addUser_afterBefore.before = samePost_lastComment.next
  } else if (rev_position - samePost_firstComment.rev_position < 100 && samePost_firstComment.prev) {
    addUser_afterBefore.after = samePost_firstComment.prev
  } else if (next) {
    addUser_afterBefore.before = next
  } else if (prev) {
    addUser_afterBefore.after = prev
  }
  addUserParam.addItems({
    author: author,
    ...(kind && {kind}),
    ...(sort && {sort}),
    ...(t && {time: t}),
    ...addUser_afterBefore,
    quarantined_subreddits,
  })
  return addUserParam.toString()
}


export default connect(Comment)
