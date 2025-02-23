/* import all from folder */
// const importAll = f => f.keys().forEach(f)
//       importAll(require.context('./libs', false, /\.(js)$/))

const greeting = () => {
  let terminalWidth = 250
  let terminalWidthDefault = terminalWidth || 250
  let strs = ['Wake up ', 'parubok.sashko@gmail.com ']
  let substr = ''
  let counter = 0
  let launchChance = 0
  let cursorTime = 500
  let cursor = () => ((new Date().getTime() / cursorTime)%2 > 1 ? '█' : ' ')

  const finish = (style) => {
    let timerId = setInterval(() => {
      console.clear();
      console.log(`%c${substr}${cursor()}`, style)
    }, cursorTime)

    setTimeout(() => {clearInterval(timerId)}, 15000)
  }

  const greeting = (factor = Math.random()) => {
    setTimeout(() => {
      let style = `background: #222; color: #0c0; padding: 5px ${terminalWidth}px 23px 8px; font-size: 15px;`
      console.clear(); terminalWidth -= 8.4
      console.log(`%c${substr += strs[counter].charAt(substr.length)}${cursor()}`, style)
      if (strs[counter] == substr) {
        counter++;
        if (counter != strs.length) {
          substr = '' ; greeting(5);
          terminalWidth = terminalWidthDefault;
        } else {finish(style)};
      } else greeting()
    }, factor * 500)
  }; if (Math.random() < launchChance) greeting()
}; greeting()
