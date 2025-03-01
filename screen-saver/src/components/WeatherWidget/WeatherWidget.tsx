import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WeatherWidget.scss';
import localStorageService from '../../services/localStorageService/localStorageService';

const WeatherWidget: React.FC = () => {
  const [city, setCity] = useState<string>('');
  const [weather, setWeather] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY; // Updated to match your env variable

  // Load the last searched city from localStorage on mount
  useEffect(() => {
    const savedCity = localStorageService.getItem<string>('lastCity');
    if (savedCity) {
      setCity(savedCity);
      fetchWeather(savedCity); // Auto-fetch weather for the saved city
    }
  }, []);

  // Update weather every 10 minutes
  useEffect(() => {
    if (city) {
      const interval = setInterval(() => {
        fetchWeather(city);
      }, 600_000);
      return () => clearInterval(interval);
    }
  }, [city]);

  const fetchWeather = async (cityName: string) => {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric`
      );
      setWeather(response.data);
      setError(null);
      // Save the city to localStorage using the updated service
      localStorageService.setItem('lastCity', cityName);
    } catch (err) {
      setError('City not found or API error');
      setWeather(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim()) fetchWeather(city);
  };

  return (
    <div className="weather-widget">
      <h2>Weather Widget</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter city name"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <button type="submit">Get Weather</button>
      </form>

      {error && <p className="error">{error}</p>}
      {weather && (
        <div className="weather-info">
          <h3>{weather.name}, {weather.sys.country}</h3>
          <p>{weather.weather[0].description}</p>
          <p>Temperature: {weather.main.temp}°C</p>
          <p>Humidity: {weather.main.humidity}%</p>
          <p>Wind: {weather.wind.speed} m/s</p>
          <img
            src={`http://openweathermap.org/img/wn/${weather.weather[0].icon}.png`}
            alt="Weather icon"
          />
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;
