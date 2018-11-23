const typogr = require('typogr')
const { DateTime } = require('luxon')

module.exports = {
  typogrFormat: function (value) {
    return typogr(value).chain().initQuotes().smartypants().value()
  },

  isoDate: function (dateValue) {
    return DateTime.local().toISO()
  },

  ifOr: function (var1, var2, options) {
    return (var1 || var2) ? options.fn(this) : options.inverse(this)
  },

  ifAnd: function (var1, var2, options) {
    return (var1 && var2) ? options.fn(this) : options.inverse(this)
  },

  ifEqual: function (val, test, options) {
    if (typeof test === 'undefined') {
      return options.inverse(this)
    }
    if (typeof test === 'number' || typeof test === 'boolean') {
      if (val === test) {
        return options.fn(this)
      } else {
        return options.inverse(this)
      }
    }
    const arrTest = test.split('||')
    for (var i = 0; i < arrTest.length; i++) {
      if (val === arrTest[i]) {
        return options.fn(this)
      }
    }
    return options.inverse(this)
  }
}
