/**
 * @file Funções utilitárias.
 */

import { MIN_FREQ, MAX_FREQ } from './constants.js';

/**
 * Converte um valor linear (0-100) para uma frequência logarítmica.
 * @param {number} value O valor linear do slider (0-100).
 * @returns {number} A frequência logarítmica correspondente.
 */
export function linearToLog(value) {
    if (value <= 0) return MIN_FREQ;
    return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, value / 100);
}

/**
 * Converte uma frequência logarítmica de volta para um valor linear (0-100).
 * @param {number} freq O valor da frequência.
 * @returns {number} O valor linear correspondente para o slider.
 */
export function logToLinear(freq) {
    if (freq <= MIN_FREQ) return 0;
    return 100 * Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ);
}
