const util = require('util')
const { execFile } = require('child_process')
const { baseUrl, defaultPathToContent } = require('../../config/constants')
const { titleFormatter } = require('../libs/title-formatter/title-formatter')

function getPersons(personGetter) {
  return function(data) {
    const { doc } = data
    const persons = typeof personGetter === 'function'
      ? personGetter(doc)
      : doc.data[personGetter]

    return (Array.isArray(persons) ? persons : [persons]).filter(Boolean)
  }
}

function getPopulatedPersons(personKey) {
  return function(data) {
    const { peopleById } = data.collections
    const personsIds = data[personKey] || []

    return personsIds.map(personId => peopleById[personId]
      ? peopleById[personId]
      : {
          data: {
            name: personId
          }
        }
    )
  }
}

function hasTag(tags, tag) {
  return (tags || []).includes(tag)
}

async function executeProgram(program, args, options) {
  const { stdout } = await util.promisify(execFile)(program, args.split(' '), options)
  return stdout
}

function getLastCommitDate(filePath, options) {
  return executeProgram('git', `--no-pager log -n 1 --format="%ci" -- ${filePath}`, options)
}

function getFirstCommitDate(filePath, options) {
  return executeProgram('git', `--no-pager log --reverse --format="%ci" -- ${filePath}`, options)
    // `git log` с опцией `reverse -n1` выводит последний коммит, а не первый
    // поэтому выводим списком и парсим
    .then(output => output.split('\n')[0])
}

module.exports = {
  layout: 'base.njk',

  pagination: {
    data: 'collections.docs',
    size: 1,
    alias: 'doc'
  },

  permalink: '/{{doc.filePathStem}}.html',

  pageType: 'Article',

  eleventyComputed: {
    title: function(data) {
      const { doc } = data
      return doc.data.title
    },

    cover: function(data) {
      const { doc } = data
      return doc.data.cover
    },

    description: function(data) {
      const { doc } = data
      return doc.data.description
    },

    authors: getPersons('authors'),

    populatedAuthors: getPopulatedPersons('authors'),

    contributors: getPersons('contributors'),

    populatedContributors: getPopulatedPersons('contributors'),

    editors: getPersons('editors'),

    populatedEditors: getPopulatedPersons('editors'),

    coverAuthors: getPersons(doc => doc.data?.cover?.author),

    populatedCoverAuthors: getPopulatedPersons('coverAuthors'),

    docPath: function(data) {
      const { doc } = data
      // Удаляем `/index` с конца пути (цель - из строки `/js/index-of/index` получить `/js/index-of`)
      return doc.filePathStem.replace(/\/index$/, '')
    },

    defaultOpenGraphPath: function(data) {
      const { doc, docPath } = data
      if (doc.data?.cover?.og) {
        return baseUrl + docPath + '/' + doc.data.cover.og
      } else {
        return data.fullPageUrl + 'images/covers/og.png'
      }
    },

    defaultTwitterPath: function(data) {
      const { doc, docPath } = data
      if (doc.data?.cover?.twitter) {
        return baseUrl + docPath + '/' + doc.data.cover.twitter
      } else {
        return data.fullPageUrl + 'images/covers/twitter.png'
      }
    },

    category: function(data) {
      const { doc } = data
      return doc.filePathStem.split('/')[1]
    },

    categoryName: function(data) {
      const { category, collections } = data
      return collections.articleIndexes
        .find(section => section.fileSlug === category)?.data.name
    },

    docId: function(data) {
      const { category, doc } = data
      const { fileSlug } = doc
      return `${category}/${fileSlug}`
    },

    type: function(data) {
      const { doc } = data
      return hasTag(doc.data.tags, 'article') ? 'article' : 'doka'
    },

    baseUrl,

    practices: function(data) {
      const allPractices = data.collections.practice
      const { docPath } = data

      return allPractices.filter(practice => {
        return practice.filePathStem.startsWith(`${docPath}/practice`)
      })
    },

    containsPractice: function(data) {
      const { practices } = data
      return (practices.length > 0) ? 'true' : 'false'
    },

    createdAt: async function(data) {
      const { docId } = data

      if (!docId) {
        return
      }

      const date = await getFirstCommitDate(docId, {
        cwd: defaultPathToContent
      })

      return date ? new Date(date) : null
    },

    updatedAt: async function(data) {
      const { docId } = data

      if (!docId) {
        return
      }

      const date = await getLastCommitDate(docId, {
        cwd: defaultPathToContent
      })

      return date ? new Date(date) : null
    },

    isPlaceholder: function(data) {
      const { doc } = data
      return hasTag(doc.data.tags, 'placeholder')
    },

    documentTitle: function(data) {
      // удаляем символы обратных кавычек html-тегов из markdown
      const title = data.title.replace(/`/g, '')
      return titleFormatter([title, data.categoryName, 'Дока'])
    },

    socialTitle: function(data) {
      const { documentTitle } = data
      // Удаляем символы угловых скобок HTML-тегов из markdown, так как соцсети их некорректно отображают
      return documentTitle
        .replace(/</g, '')
        .replace(/>/g, '')
    },

    documentDescription: function(data) {
      const { description } = data
      return description
        ?.replace(/`/g, '')
        ?.replace(/</g, '')
        ?.replace(/>/g, '')
    },

    articleTag: function(data) {
      const { doc } = data
      return doc.data.tags[0]
    },
  }
}
