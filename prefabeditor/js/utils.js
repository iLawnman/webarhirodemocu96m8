/** Утилиты: пути, экранирование, base64, dataset, transform */

export function normalizePath(path) {
    if (!path) return '';
    let p = path.trim();
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    if (p.startsWith('./')) return p;
    if (p.startsWith('/')) return '.' + p;
    return './assets/' + p;
}

export function escapeAttr(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function encodeHtmlB64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

export function decodeHtmlB64(str) {
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        return '';
    }
}

export function getDataset(node) {
    const data = {};
    for (const attr of node.attributes) {
        let name = attr.name;
        if (name.startsWith('data-')) {
            name = name.slice(5);
        }
        const camelCaseKey = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
        data[camelCaseKey] = attr.value;
    }
    return data;
}

export function applyTransformData(mesh, data) {
    if (data.position) {
        const pos = data.position.split(',').map(Number);
        if (pos.length === 3 && !pos.some(isNaN)) mesh.position.set(pos[0], pos[1], pos[2]);
    }
    if (data.rotation) {
        const rot = data.rotation.split(',').map(v => THREE.MathUtils.degToRad(parseFloat(v) || 0));
        if (rot.length === 3) mesh.rotation.set(rot[0], rot[1], rot[2]);
    }
    if (data.scale) {
        const scl = data.scale.split(',').map(Number);
        if (scl.length === 3 && !scl.some(isNaN)) mesh.scale.set(scl[0], scl[1], scl[2]);
    }
}