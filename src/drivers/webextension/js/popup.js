'use strict'
/* eslint-env browser */
/* globals chrome, Utils */

const { agent, open, i18n, getOption, setOption, promisify } = Utils

const Popup = {
  port: chrome.runtime.connect({ name: 'popup.js' }),

  /**
   * Initialise popup
   */
  async init() {
    // Templates
    Popup.templates = Array.from(
      document.querySelectorAll('[data-template]')
    ).reduce((templates, template) => {
      templates[template.dataset.template] = template.cloneNode(true)

      template.remove()

      return templates
    }, {})

    // Theme mode
    const themeMode = await getOption('themeMode', false)

    if (themeMode) {
      document.querySelector('body').classList.add('theme-mode')
    }

    // Terms
    const termsAccepted =
      agent === 'chrome' || (await getOption('termsAccepted', false))

    if (termsAccepted) {
      Popup.driver('getDetections')
    } else {
      document.querySelector('.terms').style.display = 'flex'
      document.querySelector('.detections').style.display = 'none'
      document.querySelector('.empty').style.display = 'none'

      document.querySelector('.terms').addEventListener('click', async () => {
        await setOption('termsAccepted', true)

        document.querySelector('.terms').remove()
        document.querySelector('.detections').style.display = 'block'
        document.querySelector('.empty').style.display = 'block'

        Popup.driver('getDetections')
      })

      // Apply internationalization
      i18n()
    }

    // Alert
    const [{ url }] = await promisify(chrome.tabs, 'query', {
      active: true,
      currentWindow: true
    })

    document.querySelector(
      '.alerts__link'
    ).href = `https://www.wappalyzer.com/alerts/manage?url=${encodeURIComponent(
      `${url}`
    )}`

    document
      .querySelector('.footer__settings')
      .addEventListener('click', () => chrome.runtime.openOptionsPage())
  },

  /**
   * Call a function on driver.js through messaging
   * @param {function} func
   * @param  {...any} args
   */
  driver(func, ...args) {
    Popup.port.postMessage({ func, args })
  },

  /**
   * Log debug messages to the console
   * @param {String} message
   */
  log(message) {
    Popup.driver('log', message, 'popup.js')
  },

  /**
   * Group technologies into categories
   * @param {Object} technologies
   */
  categorise(technologies) {
    return Object.values(
      technologies.reduce((categories, technology) => {
        technology.categories.forEach((category) => {
          categories[category.id] = categories[category.id] || {
            ...category,
            technologies: []
          }

          categories[category.id].technologies.push(technology)
        })

        return categories
      }, {})
    )
  },

  /**
   * Callback for getDetection listener
   * @param {Array} detections
   */
  async onGetDetections(detections) {
    const pinnedCategory = await getOption('pinnedCategory')

    if (detections.length) {
      document.querySelector('.empty').remove()
    }

    const categorised = Popup.categorise(detections)

    categorised.forEach(({ id, name, slug: categorySlug, technologies }) => {
      const categoryNode = Popup.templates.category.cloneNode(true)

      const link = categoryNode.querySelector('.category__link')

      link.href = `https://www.wappalyzer.com/technologies/${categorySlug}`
      link.dataset.i18n = `categoryName${id}`

      const pins = categoryNode.querySelectorAll('.category__pin')

      if (pinnedCategory === id) {
        pins.forEach((pin) => pin.classList.add('category__pin--active'))
      }

      pins.forEach((pin) =>
        pin.addEventListener('click', async () => {
          const pinnedCategory = await getOption('pinnedCategory')

          Array.from(
            document.querySelectorAll('.category__pin--active')
          ).forEach((pin) => pin.classList.remove('category__pin--active'))

          if (pinnedCategory === id) {
            await setOption('pinnedCategory', null)
          } else {
            await setOption('pinnedCategory', id)

            pins.forEach((pin) => pin.classList.add('category__pin--active'))
          }
        })
      )

      technologies
        .filter(({ confidence }) => confidence >= 50)
        .forEach(({ name, slug, confidence, version, icon, website }) => {
          const technologyNode = Popup.templates.technology.cloneNode(true)

          const image = technologyNode.querySelector('.technology__icon')

          image.src = `../images/icons/${icon}`

          const link = technologyNode.querySelector('.technology__link')

          link.href = `https://www.wappalyzer.com/technologies/${categorySlug}/${slug}`
          link.textContent = name

          const confidenceNode = technologyNode.querySelector(
            '.technology__confidence'
          )

          if (confidence < 100) {
            confidenceNode.textContent = `${confidence}% sure`
          } else {
            confidenceNode.remove()
          }

          const versionNode = technologyNode.querySelector(
            '.technology__version'
          )

          if (version) {
            versionNode.textContent = version
          } else {
            versionNode.remove()
          }

          categoryNode
            .querySelector('.technologies')
            .appendChild(technologyNode)
        })

      document.querySelector('.detections').appendChild(categoryNode)
    })

    if (categorised.length === 1) {
      document
        .querySelector('.detections')
        .appendChild(Popup.templates.category.cloneNode(true))
    }

    Array.from(document.querySelectorAll('a')).forEach((a) =>
      a.addEventListener('click', (event) => {
        event.preventDefault()

        open(a.href)

        return false
      })
    )

    i18n()
  }
}

// Add listener for popup PostMessage API
Popup.port.onMessage.addListener(({ func, args }) => {
  const onFunc = `on${func.charAt(0).toUpperCase() + func.slice(1)}`

  if (Popup[onFunc]) {
    Popup[onFunc](args)
  }
})

if (/complete|interactive|loaded/.test(document.readyState)) {
  Popup.init()
} else {
  document.addEventListener('DOMContentLoaded', Popup.init)
}
