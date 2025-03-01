import React, { useState, useEffect } from 'react';
import './TimeWidget.scss';
import localStorageService from '../../services/localStorageService/localStorageService';

const TimeWidget: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [timezone, setTimezone] = useState<string>(
    localStorageService.getItem<string>('lastTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const time = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
      });
      setCurrentTime(time);
    };

    updateTime(); // Set initial time
    const intervalId = setInterval(updateTime, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [timezone]);

  // Handle timezone change
  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTimezone = e.target.value;
    setTimezone(newTimezone);
    localStorageService.setItem('lastTimezone', newTimezone);
  };

  // List of common timezones (you can expand this)
  const timezoneOptions = [
    { label: 'Local Time', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { label: 'UTC', value: 'UTC' },
    { label: 'Ukraine Time (Kyiv)', value: 'Europe/Kiev' },
    { label: 'Germany Time (Berlin)', value: 'Europe/Berlin' },
  ];

  return (
    <div className="time-widget">
      <h2>Current Time</h2>
      <div className="time-display">{currentTime}</div>
      <select value={timezone} onChange={handleTimezoneChange}>
        {timezoneOptions.map((tz) => (
          <option key={tz.label} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimeWidget;
