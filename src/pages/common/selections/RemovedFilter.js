import React from 'react'
import { connect, removedFilter_types, removedFilter_text } from 'state'
import { Selection } from './SelectionBase'

class RemovedFilter extends React.Component {

  isChecked(filterType) {
    return this.props.global.state.removedFilter === filterType
  }

  render() {
    const removedFilter = this.props.global.state.removedFilter
    const {page_type} = this.props

    const updateStateAndURL = this.props.global.removedFilter_update
    return (
      <Selection className='removalStatusFilter' isFilter={true} isSet={removedFilter !== removedFilter_types.all} title='Status'>
        {Object.keys(removedFilter_types).map(type =>
          <label key={type}>
            <input name='removedFilter_types' type='radio' value={removedFilter_types[type]}
              checked={this.isChecked(removedFilter_types[type])}
              onChange={(e) => updateStateAndURL(e.target.value, page_type)}/>
            <span>{removedFilter_text[type]}</span>
          </label>
        )}
      </Selection>
    )
  }
}

export default connect(RemovedFilter)
