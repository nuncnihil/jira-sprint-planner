// UI Constants
export const DEFAULT_CAPACITY = 40;
export const SPRINT_GOAL_ROWS = 3;

// Color Families (Material Design) - ordered for maximum distinction
export const COLOR_FAMILIES = [
  { name: 'blue', initiative: '#1976d2', shades: ['#E3F2FD', '#90CAF9', '#42A5F5', '#1976D2', '#0D47A1'] },
  { name: 'orange', initiative: '#f57c00', shades: ['#FFF3E0', '#FFB74D', '#FB8C00', '#F57C00', '#E65100'] },
  { name: 'green', initiative: '#388e3c', shades: ['#E8F5E9', '#81C784', '#4CAF50', '#388E3C', '#1B5E20'] },
  { name: 'red', initiative: '#c62828', shades: ['#FFEBEE', '#E57373', '#F44336', '#C62828', '#B71C1C'] },
  { name: 'teal', initiative: '#00796b', shades: ['#E0F2F1', '#4DB6AC', '#26A69A', '#00796B', '#004D40'] },
  { name: 'purple', initiative: '#7b1fa2', shades: ['#F3E5F5', '#CE93D8', '#AB47BC', '#7B1FA2', '#4A148C'] },
  { name: 'cyan', initiative: '#0097a7', shades: ['#E0F7FA', '#4DD0E1', '#00BCD4', '#0097A7', '#006064'] },
  { name: 'indigo', initiative: '#303f9f', shades: ['#E8EAF6', '#7986CB', '#5C6BC0', '#303F9F', '#1A237E'] },
];

// Epic shade indices to use (skip 0=too light, 4=too dark)
export const EPIC_SHADE_INDICES = [1, 2, 3];

// Category Types
export const CATEGORIES = {
  GOAL: 'goal',
  EE: 'ee',
  OTHER: 'other'
};

