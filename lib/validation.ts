// Règles de saisie partagées entre le formulaire d'auth et l'API.
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME = /^[a-zA-Z0-9._]{3,30}$/;
export const PASSWORD_MIN = 6;
export const BIO_MAX = 150;
export const CAPTION_MAX = 2200;
export const COMMENT_MAX = 500;
export const MESSAGE_MAX = 1000;
