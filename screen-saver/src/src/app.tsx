import TimeWidget from '../components/TimeWidget/TimeWidget'
import WeatherWidget from '../components/WeatherWidget/WeatherWidget'
import './app.scss'

function App() {
  return <>
      <div className='app'>
        <WeatherWidget />
        <TimeWidget />
      </div>
  </>
}

export default App;
