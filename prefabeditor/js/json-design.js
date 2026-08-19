/** Загрузка и разбор JSON-дизайна в префаб */

import { normalizePath, escapeAttr } from './utils.js';
import { DESIGN_PROP_KEYS, serializePropPanelDiv } from './panels.js';

let lastJsonDesign = null;

export function handleJsonDesignSelect(event, onBuilt) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            buildDesignFromJson(data, undefined, onBuilt);
        } catch (err) {
            alert('Ошибка при чтении JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}

export function handleJsonRowChange(event, onBuilt) {
    const rowIndex = parseInt(event.target.value, 10);
    if (lastJsonDesign) buildDesignFromJson(lastJsonDesign, rowIndex, onBuilt);
}

export function buildDesignFromJson(jsonData, rowIndex, onBuilt) {
    if (!Array.isArray(jsonData) || jsonData.length < 2) {
        alert('Неверный формат JSON-дизайна.');
        return;
    }

    lastJsonDesign = jsonData;

    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);
    const idx = Number.isInteger(rowIndex) ? rowIndex : 0;
    const values = dataRows[idx] || dataRows[0];

    const selectorEl = document.getElementById('json-row-selector');
    if (selectorEl) {
        if (dataRows.length > 1) {
            selectorEl.style.display = '';
            selectorEl.innerHTML = dataRows.map((row, i) => {
                const label = row[0] || row[1] || ('Вариант ' + (i + 1));
                return `<option value="${i}" ${i === idx ? 'selected' : ''}>${label}</option>`;
            }).join('');
        } else {
            selectorEl.style.display = 'none';
        }
    }

    const panelsMap = {};
    const order = [];

    headers.forEach((header, index) => {
        const val = values[index];
        if (val === undefined || val === null || val === '') return;
        if (header === 'id' || header === 'name' || header === 'Res_Check') return;

        const separatorIndex = header.lastIndexOf('_');
        if (separatorIndex === -1) return;

        const panelName = header.substring(0, separatorIndex);
        const propType = header.substring(separatorIndex + 1).toLowerCase();
        if (!DESIGN_PROP_KEYS.includes(propType)) return;

        if (!panelsMap[panelName]) {
            panelsMap[panelName] = { group: panelName };
            order.push(panelName);
        }

        let processedVal = val;
        if (['image', 'prefab'].includes(propType) || String(val).match(/\.(png|jpg|jpeg|obj|fbx|prefab)$/i)) {
            processedVal = normalizePath(String(val));
        }

        panelsMap[panelName][propType] = processedVal;
    });

    if (order.length === 0) {
        alert('В JSON не найдено ни одной группы панелей (проверьте формат ключей "Имя_Свойство").');
        return;
    }

    const cols = Math.max(1, Math.ceil(Math.sqrt(order.length)));
    const rows = Math.ceil(order.length / cols);
    const spacingX = 0.34;
    const spacingY = 0.22;
    const panelW = 0.3;
    const panelH = 0.18;

    let panelsHtml = '';
    order.forEach((panelName, i) => {
        const props = panelsMap[panelName];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * spacingX;
        const y = ((rows - 1) / 2 - row) * spacingY;

        panelsHtml += `  <panel name="${escapeAttr(panelName)}" data-width="${panelW}" data-height="${panelH}" data-position="${x.toFixed(3)},${y.toFixed(3)},0" data-rotation="0,0,0">\n`;
        panelsHtml += `    ${serializePropPanelDiv(props)}\n`;
        panelsHtml += `  </panel>\n`;
    });

    const generatedTemplate = `<template id="ar-target">\n${panelsHtml}</template>`;
    if (onBuilt) onBuilt(generatedTemplate);
}