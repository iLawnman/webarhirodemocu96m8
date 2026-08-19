/** Точка входа редактора префабов */

import { init3D, setSceneCallbacks, selectObject } from './scene.js';
import {
    renderInspector, clearInspector, updateInspectorFromTransform,
    updateObjName, updateObjTransform, updateObjectProp, updateDesignPanelProp,
    updatePanelCSS,
    addUIElement, updateUIElement, removeUIElement,
    addObject3D, addPanel, addVideoObject3D, addHtmlObject3D, deleteSelectedObject
} from './inspector.js';
import { loadLocalPrefab, handleFileSelect, exportHTML, parseAndBuildPrefab, updateHierarchyTree } from './io.js';
import { handleJsonDesignSelect, handleJsonRowChange } from './json-design.js';

function onSelect() {
    updateHierarchyTree();
    renderInspector();
}

function onDeselect() {
    updateHierarchyTree();
    clearInspector();
}

setSceneCallbacks({
    onSelect,
    onDeselect,
    onTransformChange: updateInspectorFromTransform
});

window.__editor = {
    loadLocalPrefab,
    handleFileSelect,
    handleJsonDesignSelect: (e) => handleJsonDesignSelect(e, parseAndBuildPrefab),
    handleJsonRowChange: (e) => handleJsonRowChange(e, parseAndBuildPrefab),
    exportHTML,
    addObject3D,
    addPanel,
    addVideoObject3D,
    addHtmlObject3D,
    updateObjName,
    updateObjTransform,
    updateObjectProp,
    updateDesignPanelProp,
    updatePanelCSS,
    addUIElement,
    updateUIElement,
    removeUIElement,
    deleteSelectedObject,
    selectObject
};

window.onload = () => {
    Promise.resolve(init3D()).then(() => {
        loadLocalPrefab();
    });
};
