/**
 * three-global.js — Loads Three.js core + addons from the LOCAL bundled
 * copy (renderer/vendor/three) instead of a CDN, and exposes everything
 * on window.THREE the same way the rest of the app expects (window.THREE,
 * window.THREE.OrbitControls, window.THREE.GLTFLoader, ...).
 *
 * This runs as a native ES module (type="module"), so it is deferred and
 * guaranteed by the spec to finish BEFORE the "DOMContentLoaded" event —
 * i.e. before viewport.js's DOMContentLoaded handler executes and tries
 * to use THREE. No network/CDN access is required, so the app keeps
 * working fully offline.
 */
import * as THREE from 'three';
import { OrbitControls } from '/vendor/three/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/vendor/three/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from '/vendor/three/jsm/loaders/OBJLoader.js';
import { STLLoader } from '/vendor/three/jsm/loaders/STLLoader.js';
import { PLYLoader } from '/vendor/three/jsm/loaders/PLYLoader.js';
import { GLTFExporter } from '/vendor/three/jsm/exporters/GLTFExporter.js';
import { STLExporter } from '/vendor/three/jsm/exporters/STLExporter.js';
import { OBJExporter } from '/vendor/three/jsm/exporters/OBJExporter.js';

// THREE (a module namespace object) is read-only, so build a fresh,
// mutable object that also carries the addon classes the app expects
// as THREE.XxxLoader / THREE.XxxExporter / THREE.OrbitControls.
window.THREE = {
  ...THREE,
  OrbitControls,
  GLTFLoader,
  OBJLoader,
  STLLoader,
  PLYLoader,
  GLTFExporter,
  STLExporter,
  OBJExporter
};
