import React from 'react';

// momo official vector logo matching exact design:
// Rounded arches for 'm' and smooth geometric circles for 'o' in vivid magenta (#E6007E)
export const MomoLogo = ({ height = 18, style = {} }) => (
  <svg
    height={height}
    viewBox="0 0 255 65"
    fill="#E6007E"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    {/* First 'm' */}
    <path d="M12 58V26a15 15 0 0 1 30 0v32h-11V30a4 4 0 0 0-8 0v28H12z" />
    <path d="M42 58V26a15 15 0 0 1 30 0v32h-11V30a4 4 0 0 0-8 0v28H42z" />
    {/* First 'o' */}
    <path d="M100 36.5c0-12 9.5-21.5 21.5-21.5S143 24.5 143 36.5s-9.5 21.5-21.5 21.5S100 48.5 100 36.5zm32 0c0-6-4.5-10.5-10.5-10.5s-10.5 4.5-10.5 10.5 4.5 10.5 10.5 10.5 10.5-4.5 10.5-10.5z" />
    {/* Second 'm' */}
    <path d="M152 58V26a15 15 0 0 1 30 0v32h-11V30a4 4 0 0 0-8 0v28h-11z" />
    <path d="M182 58V26a15 15 0 0 1 30 0v32h-11V30a4 4 0 0 0-8 0v28h-11z" />
    {/* Second 'o' */}
    <path d="M214 36.5c0-12 9.5-21.5 21.5-21.5S257 24.5 257 36.5s-9.5 21.5-21.5 21.5S214 48.5 214 36.5zm32 0c0-6-4.5-10.5-10.5-10.5s-10.5 4.5-10.5 10.5 4.5 10.5 10.5 10.5 10.5-4.5 10.5-10.5z" />
  </svg>
);
