import React from 'react'
import { connect } from 'state'
import { Selection } from './SelectionBase'

class CategoryFilter extends React.Component {

  render() {
    const category_visible_counts = {}
    const category_counts = {}
    const category_unique_to_displayValue = {}

    const { type, title, page_type } = this.props
    let unique_field = type
    if (this.props.unique_field) {
      unique_field = this.props.unique_field
    }
    const items = this.props.global.state.items
    items.forEach(item => {
      const unique_value = item[unique_field]
      category_visible_counts[unique_value] = 0
      category_unique_to_displayValue[unique_value] = item[type]
      if (unique_value in category_counts) {
        category_counts[unique_value] += 1
      } else {
        category_counts[unique_value] = 1
      }
    })
    this.props.visibleItemsWithoutCategoryFilter.forEach(item => {
      category_visible_counts[item[unique_field]] += 1
    })
    const category_ordered = Object.keys(category_visible_counts).sort((a,b) => {
      let alpha = a.toLowerCase() < b.toLowerCase() ? -1 : 1
      return (category_visible_counts[b] - category_visible_counts[a]) || alpha
    })
    let categoryFilter = this.props.global.state['categoryFilter_'+type]
    if (! categoryFilter) {
      categoryFilter = 'all'
    }
    const updateStateAndURL = this.props.global.categoryFilter_update

    return (
      <Selection className='categoryFilter' isFilter={true} isSet={categoryFilter !== 'all'} title={title}>
        <select value={categoryFilter}
          onChange={(e) => updateStateAndURL(type, e.target.value, page_type )}>
          <option key='all' value='all'>all</option>
          {
            category_ordered.map(category => {
              let displayValue = category_unique_to_displayValue[category]
              if (displayValue.length > 30) {
                displayValue = displayValue.substr(0, 30)+'...'
              }
              return (
                <option key={category} value={category}>
                  ({`${category_visible_counts[category]} / ${category_counts[category]}`}) {displayValue}
                </option>
              )
            })
          }
        </select>
      </Selection>
    )
  }
}

export default connect(CategoryFilter)
