import type { MessageKey } from './en';

export type Plural = { one: string; other: string };
export type Message = string | Plural;
/** Every language must define every key — a missing translation is a compile error. */
export type Dictionary = Record<MessageKey, Message>;
export type Locale = 'en' | 'kn' | 'hi';
