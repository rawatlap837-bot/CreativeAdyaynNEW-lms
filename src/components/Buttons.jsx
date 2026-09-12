import React from 'react';
import styled from 'styled-components';

const Button = () => {
  return (
    <StyledWrapper>
      <button className="btn-donate">Exlpore Courses</button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .btn-donate {
    --clr-font-main: hsla(0 0% 20% / 100);
    --btn-bg-1: hsla(280 100% 74% / 1);
    --btn-bg-2: hsla(262 83% 58% / 1);
    --btn-bg-color: hsla(360 100% 100% / 1);
    --radii: 0.5em;
    cursor: pointer;
    padding: 0.9em 1.4em;
    min-width: 120px;
    min-height: 44px;
    font-size: var(--size, 1rem);
    font-weight: 500;
    transition: 0.8s;
    background-size: 280% auto;
    background-image: linear-gradient(
      325deg,
      var(--btn-bg-2) 0%,
      var(--btn-bg-1) 55%,
      var(--btn-bg-2) 90%
    );
    border: none;
    border-radius: var(--radii);
    color: var(--btn-bg-color);
    box-shadow:
      0px 0px 20px rgba(139, 92, 246, 0.5),
      0px 5px 5px -1px rgba(109, 63, 192, 0.25),
      inset 4px 4px 8px rgba(216, 189, 250, 0.5),
      inset -4px -4px 8px rgba(82, 39, 255, 0.35);
  }
  .btn-donate:hover {
    background-position: right top;
  }
  .btn-donate:is(:focus, :focus-visible, :active) {
    outline: none;
    box-shadow:
      0 0 0 3px var(--btn-bg-color),
      0 0 0 6px var(--btn-bg-2);
  }
  @media (min-width: 640px) {
    .btn-donate {
      padding: 1.1em 1.9em;
      min-width: 160px;
      min-height: 52px;
      font-size: 1.15rem;
    }
  }
  @media (min-width: 1024px) {
    .btn-donate {
      padding: 0.5em 1.5em;
      min-width: 190px;
      min-height: 58px;
      font-size: 1.7rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .btn-donate {
      transition: linear;
    }
  }`;

export default Button;