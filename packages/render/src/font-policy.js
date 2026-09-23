// Generated deliberately by scripts/update-font-policy.mjs from opf spec/reference/font-policy.json; never during build/install.
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const SNAPSHOT=freeze({
 "version": 1,
 "decisions": {
  "status": "provisional, owner may revise",
  "aptos-preview": {
   "replacement": "Roboto",
   "compatibility": "visual",
   "note": "Default scheme aptos previews with Roboto; the PPTX still names Aptos."
  },
  "segoe-ui-preview": {
   "replacement": "Red Hat Display",
   "compatibility": "visual",
   "note": "Segoe UI previews with Red Hat Display (catalog pack) and falls back to a bundled face."
  },
  "cambria-tier": {
   "replacement": "Caladea",
   "compatibility": "visual",
   "metricModeFallback": true,
   "note": "Cambria -> Caladea is visual: advances differ from Cambria 6.99 by a mean of 2.7%. metricModeFallback keeps metric-mode registries previewing Cambria with Caladea (reported as visual), as they did before FF-31."
  }
 },
 "source": {
  "path": "spec/reference/font-policy.json",
  "sha256": "7368c1f56b8a93c63b09cabb8aa9c5284dd9c8b1fd811f9387b05c175abbd5ac"
 },
 "families": [
  {
   "family": "Angsana New",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Unity Progress/Monotype/Microsoft, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Thai",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans Thai",
     "meanAbsWidthDelta": 0.7476,
     "meanWidthDelta": 0.7476,
     "maxAbsWidthDelta": 0.8473,
     "styles": 2,
     "reference": "Angsana New 5.06"
    }
   }
  },
  {
   "family": "Anton",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Aparajita",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Modular Infotech, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Devanagari",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Aptos",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "decision": "aptos-preview",
    "measured": {
     "replacement": "Roboto",
     "meanAbsWidthDelta": 0.0215,
     "meanWidthDelta": 0.0008,
     "maxAbsWidthDelta": 0.0739,
     "styles": 4,
     "reference": "Aptos 2.01;O365"
    },
    "family": "Roboto",
    "compatibility": "visual"
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Aptos Display",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Carlito",
    "compatibility": "visual",
    "measured": {
     "replacement": "Carlito",
     "meanAbsWidthDelta": 0.0184,
     "meanWidthDelta": -0.0057,
     "maxAbsWidthDelta": 0.0691,
     "styles": 4,
     "reference": "Aptos Display 2.01;O365"
    }
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Aptos Mono",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Cousine",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Roboto Mono"
   ]
  },
  {
   "family": "Aptos Narrow",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Carlito",
    "compatibility": "visual",
    "measured": {
     "replacement": "Carlito",
     "meanAbsWidthDelta": 0.0233,
     "meanWidthDelta": 0.0222,
     "maxAbsWidthDelta": 0.0786,
     "styles": 4,
     "reference": "Aptos Narrow 2.01;O365"
    }
   }
  },
  {
   "family": "Aptos Serif",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Tinos",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Arabic Typesetting",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Naskh Arabic",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Naskh Arabic",
     "meanAbsWidthDelta": 0.6632,
     "meanWidthDelta": 0.6632,
     "maxAbsWidthDelta": 0.7426,
     "styles": 1,
     "reference": "Arabic Typesetting 6.85"
    }
   }
  },
  {
   "family": "Archivo Narrow",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Arial",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Arimo",
    "compatibility": "metric",
    "measured": {
     "replacement": "Arimo",
     "meanAbsWidthDelta": 0,
     "meanWidthDelta": 0,
     "maxAbsWidthDelta": 0,
     "styles": 4,
     "reference": "Arial 7.06"
    },
    "source": "https://github.com/google/fonts/blob/main/ofl/arimo/METADATA.pb"
   },
   "alternates": [
    "Liberation Sans"
   ]
  },
  {
   "family": "Arial Black",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Montserrat",
    "compatibility": "visual",
    "weight": 900,
    "measured": {
     "replacement": "Montserrat",
     "meanAbsWidthDelta": 0.0075,
     "meanWidthDelta": -0.0029,
     "maxAbsWidthDelta": 0.0281,
     "styles": 1,
     "reference": "Arial Black 5.23"
    }
   },
   "alternates": [
    "Arimo"
   ]
  },
  {
   "family": "Arial Narrow",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Archivo Narrow",
    "compatibility": "visual",
    "measured": {
     "replacement": "Archivo Narrow",
     "meanAbsWidthDelta": 0.0038,
     "meanWidthDelta": 0.0035,
     "maxAbsWidthDelta": 0.0431,
     "styles": 4,
     "reference": "Arial Narrow 2.40"
    }
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Arimo",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Barlow",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Baskerville Old Face",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Stephenson Blake/URW/Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Libre Caslon Text",
    "compatibility": "visual",
    "measured": {
     "replacement": "Libre Caslon Text",
     "meanAbsWidthDelta": 0.1923,
     "meanWidthDelta": 0.1923,
     "maxAbsWidthDelta": 0.2371,
     "styles": 1,
     "reference": "Baskerville Old Face 1.51"
    }
   },
   "alternates": [
    "Tinos"
   ]
  },
  {
   "family": "Batang",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (HanYang I&C, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans KR",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "BatangChe",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (HanYang I&C, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans KR",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Bebas Neue",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Bitter",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Bodoni MT",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Playfair Display",
    "compatibility": "visual",
    "measured": {
     "replacement": "Playfair Display",
     "meanAbsWidthDelta": 0.0687,
     "meanWidthDelta": 0.0556,
     "maxAbsWidthDelta": 0.1987,
     "styles": 4,
     "reference": "Bodoni MT 2.10"
    }
   },
   "alternates": [
    "Caladea"
   ]
  },
  {
   "family": "Book Antiqua",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "PT Serif",
    "compatibility": "visual",
    "measured": {
     "replacement": "PT Serif",
     "meanAbsWidthDelta": 0.024,
     "meanWidthDelta": 0.0193,
     "maxAbsWidthDelta": 0.0778,
     "styles": 4,
     "reference": "Book Antiqua 2.35"
    }
   },
   "alternates": [
    "Caladea"
   ]
  },
  {
   "family": "Bookman Old Style",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Libre Caslon Text",
    "compatibility": "visual",
    "measured": {
     "replacement": "Libre Caslon Text",
     "meanAbsWidthDelta": 0.0411,
     "meanWidthDelta": -0.0381,
     "maxAbsWidthDelta": 0.1396,
     "styles": 4,
     "reference": "Bookman Old Style 2.35/2.36"
    }
   },
   "alternates": [
    "Gelasio"
   ]
  },
  {
   "family": "Caladea",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Calibri",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Carlito",
    "compatibility": "metric",
    "measured": {
     "replacement": "Carlito",
     "meanAbsWidthDelta": 0,
     "meanWidthDelta": 0,
     "maxAbsWidthDelta": 0.0026,
     "styles": 4,
     "reference": "Calibri 6.27"
    },
    "source": "https://github.com/googlefonts/carlito"
   }
  },
  {
   "family": "Calibri Light",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Carlito",
    "compatibility": "visual",
    "measured": {
     "replacement": "Carlito",
     "meanAbsWidthDelta": 0.0144,
     "meanWidthDelta": 0.0144,
     "maxAbsWidthDelta": 0.0225,
     "styles": 2,
     "reference": "Calibri Light 6.27"
    }
   }
  },
  {
   "family": "Cambria",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "decision": "cambria-tier",
    "measured": {
     "replacement": "Caladea",
     "meanAbsWidthDelta": 0.0269,
     "meanWidthDelta": -0.0269,
     "maxAbsWidthDelta": 0.0647,
     "styles": 4,
     "reference": "Cambria 6.99/6.98"
    },
    "source": "https://chromium.googlesource.com/external/fontconfig/+/refs/heads/main/conf.d/30-metric-aliases.conf",
    "family": "Caladea",
    "compatibility": "visual",
    "metricModeFallback": true
   }
  },
  {
   "family": "Cambria Math",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": null
  },
  {
   "family": "Candara",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Source Sans 3",
    "compatibility": "visual",
    "measured": {
     "replacement": "Source Sans 3",
     "meanAbsWidthDelta": 0.0195,
     "meanWidthDelta": 0.0064,
     "maxAbsWidthDelta": 0.0523,
     "styles": 4,
     "reference": "Candara 5.64"
    }
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Carlito",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Century Gothic",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Work Sans",
    "compatibility": "visual",
    "measured": {
     "replacement": "Work Sans",
     "meanAbsWidthDelta": 0.0255,
     "meanWidthDelta": 0.0188,
     "maxAbsWidthDelta": 0.1549,
     "styles": 4,
     "reference": "Century Gothic 2.35"
    }
   },
   "alternates": [
    "Arimo"
   ]
  },
  {
   "family": "Century Schoolbook",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Gelasio",
    "compatibility": "visual",
    "measured": {
     "replacement": "Gelasio",
     "meanAbsWidthDelta": 0.0266,
     "meanWidthDelta": -0.0175,
     "maxAbsWidthDelta": 0.0753,
     "styles": 4,
     "reference": "Century Schoolbook 2.35"
    }
   }
  },
  {
   "family": "Consolas",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Cousine",
    "compatibility": "visual",
    "measured": {
     "replacement": "Cousine",
     "meanAbsWidthDelta": 0.0915,
     "meanWidthDelta": 0.0915,
     "maxAbsWidthDelta": 0.0915,
     "styles": 4,
     "reference": "Consolas 7.01"
    }
   },
   "alternates": [
    "Roboto Mono"
   ]
  },
  {
   "family": "Constantia",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "PT Serif",
    "compatibility": "visual",
    "measured": {
     "replacement": "PT Serif",
     "meanAbsWidthDelta": 0.0229,
     "meanWidthDelta": 0.0036,
     "maxAbsWidthDelta": 0.0577,
     "styles": 4,
     "reference": "Constantia 5.93"
    }
   },
   "alternates": [
    "Caladea"
   ]
  },
  {
   "family": "Corbel",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Source Sans 3",
    "compatibility": "visual",
    "measured": {
     "replacement": "Source Sans 3",
     "meanAbsWidthDelta": 0.0157,
     "meanWidthDelta": 0.0151,
     "maxAbsWidthDelta": 0.0521,
     "styles": 4,
     "reference": "Corbel 6.01"
    }
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Courier New",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Cousine",
    "compatibility": "metric",
    "measured": {
     "replacement": "Cousine",
     "meanAbsWidthDelta": 0,
     "meanWidthDelta": 0,
     "maxAbsWidthDelta": 0,
     "styles": 4,
     "reference": "Courier New 6.95"
    },
    "source": "https://github.com/google/fonts/blob/main/ofl/cousine/METADATA.pb"
   },
   "alternates": [
    "Liberation Mono"
   ]
  },
  {
   "family": "Cousine",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "DaunPenh",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (OM Mony/Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Khmer",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "David",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Kivun Computers/Monotype, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Serif Hebrew",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Noto Sans Hebrew"
   ]
  },
  {
   "family": "Didot",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (bundled with macOS; vendor not stated on the Apple page)",
   "availability": [
    "macos"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Playfair Display",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Tinos"
   ]
  },
  {
   "family": "DilleniaUPC",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Unity Progress/Monotype/Microsoft, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Thai",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans Thai",
     "meanAbsWidthDelta": 0.7077,
     "meanWidthDelta": 0.7077,
     "maxAbsWidthDelta": 0.8544,
     "styles": 2,
     "reference": "DilleniaUPC 5.05"
    }
   }
  },
  {
   "family": "EB Garamond",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Ebrima",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans",
     "meanAbsWidthDelta": 0.0618,
     "meanWidthDelta": 0.0618,
     "maxAbsWidthDelta": 0.0934,
     "styles": 2,
     "reference": "Ebrima 5.19"
    }
   },
   "alternates": [
    "Arimo"
   ]
  },
  {
   "family": "FangSong",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Beijing ZhongYi Electronics, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans SC",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Figtree",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Franklin Gothic Book",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (ITC design, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Barlow",
    "compatibility": "visual",
    "measured": {
     "replacement": "Barlow",
     "meanAbsWidthDelta": 0.0181,
     "meanWidthDelta": 0.0119,
     "maxAbsWidthDelta": 0.0755,
     "styles": 2,
     "reference": "Franklin Gothic Book 2.01"
    }
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Franklin Gothic Medium",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (ITC design, licensed to Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Barlow",
    "compatibility": "visual",
    "measured": {
     "replacement": "Barlow",
     "meanAbsWidthDelta": 0.0142,
     "meanWidthDelta": -0.0043,
     "maxAbsWidthDelta": 0.0648,
     "styles": 2,
     "reference": "Franklin Gothic Medium 5.02/5.01"
    }
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Garamond",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "EB Garamond",
    "compatibility": "visual",
    "measured": {
     "replacement": "EB Garamond",
     "meanAbsWidthDelta": 0.0488,
     "meanWidthDelta": 0.0277,
     "maxAbsWidthDelta": 0.1883,
     "styles": 3,
     "reference": "Garamond 2.40"
    }
   },
   "alternates": [
    "Tinos"
   ]
  },
  {
   "family": "Gautami",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Telugu",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Gelasio",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Georgia",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Gelasio",
    "compatibility": "visual",
    "measured": {
     "replacement": "Gelasio",
     "meanAbsWidthDelta": 0.0002,
     "meanWidthDelta": -0.0002,
     "maxAbsWidthDelta": 0.0102,
     "styles": 4,
     "reference": "Georgia 5.59"
    },
    "source": "https://github.com/SorkinType/Gelasio"
   }
  },
  {
   "family": "Gill Sans MT",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Source Sans 3",
    "compatibility": "visual",
    "measured": {
     "replacement": "Source Sans 3",
     "meanAbsWidthDelta": 0.051,
     "meanWidthDelta": 0.0038,
     "maxAbsWidthDelta": 0.1456,
     "styles": 4,
     "reference": "Gill Sans MT 1.65"
    }
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Gisha",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Hebrew",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Grandview",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Barlow",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Grandview Display",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Barlow",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Gungsuh",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (HanYang I&C, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans KR",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "GungsuhChe",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (HanYang I&C, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans KR",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Impact",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Anton",
    "compatibility": "visual",
    "measured": {
     "replacement": "Anton",
     "meanAbsWidthDelta": 0.0192,
     "meanWidthDelta": -0.019,
     "maxAbsWidthDelta": 0.0512,
     "styles": 1,
     "reference": "Impact 5.11"
    }
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Kalinga",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Oriya",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Kartika",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Malayalam",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Khmer UI",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Khmer",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Latha",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Tamil",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Liberation Mono",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Liberation Sans",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Liberation Serif",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Libre Caslon Text",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Lora",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Lucida Console",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Bigelow & Holmes, licensed to Microsoft)",
   "availability": [
    "windows"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Cousine",
    "compatibility": "visual",
    "measured": {
     "replacement": "Cousine",
     "meanAbsWidthDelta": 0.0041,
     "meanWidthDelta": -0.0041,
     "maxAbsWidthDelta": 0.0041,
     "styles": 1,
     "reference": "Lucida Console 5.01"
    }
   }
  },
  {
   "family": "Lucida Sans",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Bigelow & Holmes, licensed to Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Work Sans",
    "compatibility": "visual",
    "measured": {
     "replacement": "Work Sans",
     "meanAbsWidthDelta": 0.0124,
     "meanWidthDelta": 0.0047,
     "maxAbsWidthDelta": 0.0498,
     "styles": 2,
     "reference": "Lucida Sans 1.67"
    }
   },
   "alternates": [
    "Arimo"
   ]
  },
  {
   "family": "Lucida Sans Unicode",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Bigelow & Holmes, licensed to Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Work Sans",
    "compatibility": "visual",
    "measured": {
     "replacement": "Work Sans",
     "meanAbsWidthDelta": 0.0132,
     "meanWidthDelta": 0.0102,
     "maxAbsWidthDelta": 0.0498,
     "styles": 1,
     "reference": "Lucida Sans Unicode 5.01"
    }
   },
   "alternates": [
    "Arimo"
   ]
  },
  {
   "family": "Malgun Gothic",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans KR",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans KR",
     "meanAbsWidthDelta": 0.0176,
     "meanWidthDelta": 0.0171,
     "maxAbsWidthDelta": 0.0791,
     "styles": 2,
     "reference": "Malgun Gothic 6.69"
    }
   }
  },
  {
   "family": "Mangal",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Devanagari",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Meiryo",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans JP",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Merriweather Sans",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Microsoft JhengHei",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans TC",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans TC",
     "meanAbsWidthDelta": 0.0141,
     "meanWidthDelta": 0.004,
     "maxAbsWidthDelta": 0.0611,
     "styles": 2,
     "reference": "Microsoft JhengHei 6.15"
    }
   }
  },
  {
   "family": "Microsoft Sans Serif",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Arimo",
    "compatibility": "visual",
    "measured": {
     "replacement": "Arimo",
     "meanAbsWidthDelta": 0.002,
     "meanWidthDelta": 0.0003,
     "maxAbsWidthDelta": 0.0291,
     "styles": 1,
     "reference": "Microsoft Sans Serif 7.04"
    }
   }
  },
  {
   "family": "Microsoft YaHei",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft; portions Beijing Founder)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans SC",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans SC",
     "meanAbsWidthDelta": 0.0314,
     "meanWidthDelta": -0.0314,
     "maxAbsWidthDelta": 0.059,
     "styles": 2,
     "reference": "Microsoft YaHei 6.31"
    }
   }
  },
  {
   "family": "MingLiU",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (DynaComware, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans TC",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Miriam",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Kivun Computers/Monotype, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Hebrew",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Montserrat",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "MS Gothic",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Ricoh/Ryobi Imagix, licensed to Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans JP",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans JP",
     "meanAbsWidthDelta": 0.0493,
     "meanWidthDelta": -0.0361,
     "maxAbsWidthDelta": 0.1522,
     "styles": 1,
     "reference": "MS Gothic 5.32"
    }
   }
  },
  {
   "family": "MS Mincho",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Ricoh/Ryobi Imagix, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans JP",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Nirmala UI",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Devanagari",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans Devanagari",
     "meanAbsWidthDelta": 0.0638,
     "meanWidthDelta": 0.0638,
     "maxAbsWidthDelta": 0.0939,
     "styles": 2,
     "reference": "Nirmala UI 1.46"
    }
   }
  },
  {
   "family": "Noto Naskh Arabic",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Nastaliq Urdu",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [
    "macos"
   ],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Armenian",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Bengali",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Devanagari",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Ethiopic",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Georgian",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Gujarati",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Gurmukhi",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Hebrew",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans JP",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Kannada",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [
    "macos"
   ],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Khmer",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans KR",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Malayalam",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Mongolian",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Oriya",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [
    "macos"
   ],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans SC",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Tamil",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans TC",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Telugu",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Sans Thai",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Noto Serif Hebrew",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Nyala",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Ethiopic",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Open Sans",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Palatino Linotype",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Linotype/Heidelberger, licensed to Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "PT Serif",
    "compatibility": "visual",
    "measured": {
     "replacement": "PT Serif",
     "meanAbsWidthDelta": 0.0252,
     "meanWidthDelta": 0.0213,
     "maxAbsWidthDelta": 0.0909,
     "styles": 4,
     "reference": "Palatino Linotype 5.03"
    }
   },
   "alternates": [
    "Caladea"
   ]
  },
  {
   "family": "Playfair Display",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "PMingLiU",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (DynaComware, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans TC",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Poppins",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "PT Serif",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [
    "macos"
   ],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Raavi",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Gurmukhi",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Raleway",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Red Hat Display",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Red Hat Text",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Roboto",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Roboto Mono",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Rockwell",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Bitter",
    "compatibility": "visual",
    "measured": {
     "replacement": "Bitter",
     "meanAbsWidthDelta": 0.0255,
     "meanWidthDelta": -0.0149,
     "maxAbsWidthDelta": 0.0845,
     "styles": 4,
     "reference": "Rockwell 1.65"
    }
   },
   "alternates": [
    "Gelasio"
   ]
  },
  {
   "family": "Sakkal Majalla",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft; portions Sakkal Design)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Naskh Arabic",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Naskh Arabic",
     "meanAbsWidthDelta": 0.5423,
     "meanWidthDelta": 0.5423,
     "maxAbsWidthDelta": 0.6142,
     "styles": 2,
     "reference": "Sakkal Majalla 7.00"
    }
   }
  },
  {
   "family": "Seaford",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Source Sans 3",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Seaford Display",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Source Sans 3",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Segoe UI",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "decision": "segoe-ui-preview",
    "measured": {
     "replacement": "Red Hat Display",
     "meanAbsWidthDelta": 0.0172,
     "meanWidthDelta": -0.009,
     "maxAbsWidthDelta": 0.0709,
     "styles": 4,
     "reference": "Segoe UI 5.71"
    },
    "family": "Red Hat Display",
    "compatibility": "visual"
   },
   "alternates": [
    "Open Sans",
    "Arimo"
   ]
  },
  {
   "family": "Segoe UI Emoji",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": null
  },
  {
   "family": "Segoe UI Light",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "decision": "segoe-ui-preview",
    "weight": 300,
    "measured": {
     "replacement": "Red Hat Display",
     "meanAbsWidthDelta": 0.0187,
     "meanWidthDelta": 0.0179,
     "maxAbsWidthDelta": 0.0662,
     "styles": 2,
     "reference": "Segoe UI Light 5.71"
    },
    "family": "Red Hat Display",
    "compatibility": "visual"
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Segoe UI Semibold",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "decision": "segoe-ui-preview",
    "weight": 600,
    "measured": {
     "replacement": "Red Hat Display",
     "meanAbsWidthDelta": 0.0101,
     "meanWidthDelta": -0.0013,
     "maxAbsWidthDelta": 0.0651,
     "styles": 2,
     "reference": "Segoe UI Semibold 5.71"
    },
    "family": "Red Hat Display",
    "compatibility": "visual"
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Segoe UI Semilight",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "decision": "segoe-ui-preview",
    "measured": {
     "replacement": "Red Hat Display",
     "meanAbsWidthDelta": 0.0322,
     "meanWidthDelta": 0.0321,
     "maxAbsWidthDelta": 0.0905,
     "styles": 2,
     "reference": "Segoe UI Semilight 5.71"
    },
    "family": "Red Hat Display",
    "compatibility": "visual"
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Shonar Bangla",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Bengali",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Shruti",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Gujarati",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "SimHei",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Beijing ZhongYi Electronics, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans SC",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "SimSun",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (ZhongYi Electronic, licensed to Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans SC",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans SC",
     "meanAbsWidthDelta": 0.0493,
     "meanWidthDelta": -0.0361,
     "maxAbsWidthDelta": 0.1522,
     "styles": 1,
     "reference": "SimSun 5.24"
    }
   }
  },
  {
   "family": "Skeena",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Open Sans",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Skeena Display",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Open Sans",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Carlito"
   ]
  },
  {
   "family": "Source Sans 3",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Source Sans Pro",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": true,
   "replacement": {
    "family": "Source Sans 3",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Sylfaen",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans",
     "meanAbsWidthDelta": 0.1096,
     "meanWidthDelta": 0.1096,
     "maxAbsWidthDelta": 0.1593,
     "styles": 1,
     "reference": "Sylfaen 5.08"
    }
   },
   "alternates": [
    "Noto Sans Georgian",
    "Noto Sans Armenian"
   ]
  },
  {
   "family": "Symbol",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": null
  },
  {
   "family": "Tahoma",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Red Hat Text",
    "compatibility": "visual",
    "measured": {
     "replacement": "Red Hat Text",
     "meanAbsWidthDelta": 0.0167,
     "meanWidthDelta": -0.0035,
     "maxAbsWidthDelta": 0.0629,
     "styles": 2,
     "reference": "Tahoma 7.05"
    }
   },
   "alternates": [
    "Open Sans",
    "Arimo"
   ]
  },
  {
   "family": "Tenorite",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Figtree",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Tenorite Display",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Figtree",
    "compatibility": "visual",
    "measured": null
   },
   "alternates": [
    "Roboto"
   ]
  },
  {
   "family": "Times New Roman",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Tinos",
    "compatibility": "metric",
    "measured": {
     "replacement": "Tinos",
     "meanAbsWidthDelta": 0,
     "meanWidthDelta": 0,
     "maxAbsWidthDelta": 0,
     "styles": 4,
     "reference": "Times New Roman 7.12"
    },
    "source": "https://github.com/google/fonts/blob/main/ofl/tinos/METADATA.pb"
   },
   "alternates": [
    "Liberation Serif"
   ]
  },
  {
   "family": "Tinos",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Traditional Arabic",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Monotype, licensed to Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Naskh Arabic",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Naskh Arabic",
     "meanAbsWidthDelta": 0.1573,
     "meanWidthDelta": 0.1573,
     "maxAbsWidthDelta": 0.2415,
     "styles": 2,
     "reference": "Traditional Arabic 6.85"
    }
   }
  },
  {
   "family": "Trebuchet MS",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Figtree",
    "compatibility": "visual",
    "measured": {
     "replacement": "Figtree",
     "meanAbsWidthDelta": 0.0149,
     "meanWidthDelta": -0.007,
     "maxAbsWidthDelta": 0.0665,
     "styles": 4,
     "reference": "Trebuchet MS 5.15"
    }
   },
   "alternates": [
    "Arimo"
   ]
  },
  {
   "family": "Tunga",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Kannada",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Verdana",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Montserrat",
    "compatibility": "visual",
    "measured": {
     "replacement": "Montserrat",
     "meanAbsWidthDelta": 0.0368,
     "meanWidthDelta": -0.0281,
     "maxAbsWidthDelta": 0.0915,
     "styles": 4,
     "reference": "Verdana 5.33"
    }
   },
   "alternates": [
    "Arimo"
   ]
  },
  {
   "family": "Vrinda",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows-optional",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans Bengali",
    "compatibility": "visual",
    "measured": null
   }
  },
  {
   "family": "Webdings",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": null
  },
  {
   "family": "Wingdings",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (Microsoft)",
   "availability": [
    "windows",
    "macos",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": null
  },
  {
   "family": "Work Sans",
   "licenseClass": "open",
   "license": "OFL-1.1",
   "availability": [],
   "embeddableByOpf": true,
   "replacement": null
  },
  {
   "family": "Yu Gothic",
   "licenseClass": "proprietary-standard",
   "license": "proprietary (JIYUKOBO, licensed to Microsoft)",
   "availability": [
    "windows",
    "office-cloud"
   ],
   "embeddableByOpf": false,
   "replacement": {
    "family": "Noto Sans JP",
    "compatibility": "visual",
    "measured": {
     "replacement": "Noto Sans JP",
     "meanAbsWidthDelta": 0.0091,
     "meanWidthDelta": 0.0032,
     "maxAbsWidthDelta": 0.0533,
     "styles": 2,
     "reference": "Yu Gothic 1.95"
    }
   }
  }
 ]
});
/** The OPF font policy rows (FF-31): license class, viewer availability and the open replacement. */
export const FONT_POLICY=SNAPSHOT.families;
/** Which core table this snapshot came from. */
export const FONT_POLICY_SOURCE=freeze({version:SNAPSHOT.version,...SNAPSHOT.source});
/** Provisional owner decisions applied to this snapshot (owner may revise). */
export const FONT_POLICY_DECISIONS=SNAPSHOT.decisions;
const byFamily=new Map(FONT_POLICY.map(row=>[row.family.toLowerCase(),row]));
/** The policy row for a family (case-insensitive), or undefined. */
export function fontPolicyFor(family){return typeof family==='string'?byFamily.get(family.trim().toLowerCase()):undefined;}
