
import './assets/style.scss';
import './modules/consoleGreeting';

document.addEventListener('DOMContentLoaded', () => {
  // Show context menu
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    const el = document.querySelector('.context-menu');
    if (el) el.remove();
    const links = `<div>Hi there</div>`;

    const menu = document.createElement('div');
    menu.style.cssText = `top: ${event.clientY}px; left: ${event.clientX}px;`;
    menu.classList.add('context-menu');
    menu.innerHTML = links;
    document.body.appendChild(menu);
  }, false)

  document.addEventListener('click', event => {
    const el = document.querySelector('.context-menu');
    if (el) el.remove();
  }, false)

  // Show cursor with effects
  const segSize = 5;
  const segAmount = 5;
  const segLength = 30; // px
  const coordinates = Array(segAmount).fill(0).map(_ => ({ x: 0, y: 0, angle: 0 }));
  let template = coordinates.map((_, i) => {
    return `<div
      class="cursors-circle"
      style="
        width: ${segSize - (i * 0.5) + 'px'};
        height: ${segSize - (i * 0.5) + 'px'};
        marginTop: ${(-segSize / i) / 2 + 'px'};
        marginLeft: ${(-segSize / i) / 2 + 'px'};">
    </div>`;
  }).join('');
  template += `<div class="cursor-square"></div>`;

  document.querySelector('.cursor-layer').innerHTML = template;

  const cursorSquare = document.querySelector('.cursor-square');
  const cursorTailCircles = document.querySelectorAll('.cursors-circle');

  const mouseMove = e => {
    segment(0, e.clientX, e.clientY);

    for (let i = 0; i < segAmount - 1; ++i) {
      segment(i + 1, coordinates[i].x, coordinates[i].y);
    }

    function segment(i, xin, yin) {
      let dx = xin - coordinates[i].x;
      let dy = yin - coordinates[i].y;

      coordinates[i].angle = Math.atan2(dy, dx);
      coordinates[i].x = xin - Math.cos(coordinates[i].angle) * segLength;
      coordinates[i].y = yin - Math.sin(coordinates[i].angle) * segLength;
    }

    cursorSquare.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

    for (let i = 0; i < segAmount; i++) {
      cursorTailCircles[i].style.transform = `translate(${coordinates[i].x}px, ${coordinates[i].y}px) rotate(${coordinates[i].angle}deg)`;
    }
  }
  document.addEventListener('mousemove', mouseMove);
});
