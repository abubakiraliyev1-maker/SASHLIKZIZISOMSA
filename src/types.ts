/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CarType {
  id: string;
  name: string;
  price: number;
  speed: number;
  accel: number;
  drift: number;
  image: string;
}

export interface Coin {
  id: string;
  x: number;
  y: number;
  createdAt: number;
  isSuper?: boolean;
}

export const CARS: CarType[] = [
  {
    id: 'starter',
    name: 'Oddiy Mashina',
    price: 0,
    speed: 5,
    accel: 0.1,
    drift: 0.15,
    image: '🚗'
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    price: 500,
    speed: 9,
    accel: 0.25,
    drift: 0.12,
    image: '🏎️'
  },
  {
    id: 'mercedes',
    name: 'Mercedes',
    price: 900,
    speed: 7,
    accel: 0.15,
    drift: 0.1,
    image: '🚘'
  },
  {
    id: 'bmw',
    name: 'BMW M5 90',
    price: 1500,
    speed: 8,
    accel: 0.2,
    drift: 0.08,
    image: '🏎️'
  }
];

export const COLORS = [
  '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000', '#ffa500', '#800080'
];

export const COLOR_PRICE = 10;
export const RAINBOW_PRICE = 50;
