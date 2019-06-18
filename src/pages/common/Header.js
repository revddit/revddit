import React from 'react'
import { Link } from 'react-router-dom'
import { connect } from 'state'

const getEntityName = (params) => {
  const { user, subreddit = '', userSubreddit = '', domain = ''} = params
  return (user || subreddit || userSubreddit || domain).toLowerCase()
}

class Header extends React.Component {
  state = {
    entity_name: ''
  }
  componentDidMount() {
    const entity_name = getEntityName(this.props.match.params)
    this.setState({entity_name})
  }
  componentDidUpdate(prevProps) {
    const entity_name = getEntityName(this.props.match.params)
    const prev_entity_name = getEntityName(prevProps.match.params)
    if (entity_name !== prev_entity_name) {
      this.setState({entity_name})
    }
  }
  handleSubmit = (e, defaultValue) => {
    e.preventDefault()
    const data = new FormData(e.target)
    const pair = Array.from(data.entries())[0]
    const key = pair[0], val = pair[1].trim().toLowerCase()
    if (val !== '' && (this.props.page_type === 'thread' || val !== defaultValue)) {
      console.log('update', val)
      this.setState({entity_name: val})
      window.location.href = `/${key}/${val}`
    }
  }
  onClick = (e, defaultValue) => {
    const val = e.target.value.trim().toLowerCase()
    if (val === defaultValue) {
      e.target.value = ''
    }
  }
  onBlur = (e, defaultValue) => {
    const val = e.target.value.trim().toLowerCase()
    if (val === '') {
      e.target.value = defaultValue
    }
  }
  handleNameChange = (e) => {
    this.setState({entity_name: e.target.value})
  }
  render() {
    const props = this.props
    const { page_type } = props
    let { user, subreddit = '', userSubreddit = '', domain = ''} = props.match.params
    if (userSubreddit) {
      subreddit = 'u_'+userSubreddit
    }
    let path_type = '', value = '', path_suffix = '', item_type = ''
    if (['subreddit_posts','thread'].includes(page_type)) {
      path_type = 'r'
      value = subreddit
      item_type = 'subreddit'
    } else if (page_type === 'subreddit_comments') {
      path_type = 'r'
      value = subreddit
      path_suffix = 'comments'
      item_type = 'subreddit'
    } else if (user) {
      path_type = 'user'
      value = user
      item_type = 'username'
    } else if (domain) {
      path_type = 'domain'
      value = domain
      item_type = 'domain'
    }
    value = value.toLowerCase()
    let display = `/${path_type}/`
    const maxLen = 30
    if ((domain || subreddit) && display.length > maxLen) {
      display = display.substring(0,maxLen)+'...'
    }
    return (
      <React.Fragment>
        <header>
          <div id='header'>
            <div id='title_and_forms'>
              <h1>
                <Link to='/about'>revddit</Link>
              </h1>
              <div id='forms'>
                <form className="topForm" onSubmit={this.handleSubmit}>
                  <label>
                    /r/
                    <input type='text' name='r' placeholder='subreddit'/>
                  </label>
                  <input type='submit' id='button_s' value='go' />
                </form>
                <form onSubmit={this.handleSubmit}>
                  <label>
                    /u/
                    <input type='text' name='user' placeholder='username'/>
                  </label>
                  <input type='submit' id='button_u' value='go' />
                </form>
              </div>
            </div>
            {value &&
              <div id='subheading'>
                <form onSubmit={(e) => this.handleSubmit(e, value)}>
                  <a className='subheading' href={display}>{display}</a>
                  <input type='text' onClick={(e) => this.onClick(e, value)}
                                      onBlur={(e) =>  this.onBlur(e, value)}
                  name={path_type} value={this.state.entity_name} onChange={this.handleNameChange} placeholder={item_type}/>
                  {path_suffix &&
                    <a className='subheading' href='#'>{`/${path_suffix}/`}</a>
                  }
                  <input type='submit' id='button' value='go' />
                </form>
              </div>
            }
          </div>
          <div id='status'>
            {props.global.state.statusText &&
            <p id='status-text'>{props.global.state.statusText}</p>}
            {props.global.state.statusImage &&
            <img id='status-image' src={props.global.state.statusImage} alt='status' />}
          </div>
        </header>
      </React.Fragment>
    )
  }
}

export default connect(Header)
