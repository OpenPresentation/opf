#!/usr/bin/env python3
"""Reproduce the offline quantization analysis for native-tab-v2-04.

This script reads only the retained JSON report and PPTX ZIP. It does not use
Office, fonts, UI automation, or repository source code.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from xml.etree import ElementTree as ET


EMU_PER_POINT = 12_700
FIVE_HUNDREDTH_POINT = Fraction(1, 20)
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def fraction_from_decimal(value: Decimal) -> Fraction:
    numerator, denominator = value.as_integer_ratio()
    return Fraction(numerator, denominator)


def fraction_record(value: Fraction) -> dict[str, object]:
    return {
        "numerator": value.numerator,
        "denominator": value.denominator,
        "decimal": format(Decimal(value.numerator) / Decimal(value.denominator), "f"),
    }


def float_record(value: float) -> dict[str, object]:
    exact = Fraction.from_float(value)
    return {
        "value": value,
        "hex": value.hex(),
        "exact": fraction_record(exact),
    }


def float32(value: Fraction | float) -> float:
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def float32_bits(value: float) -> str:
    return f"0x{struct.unpack('<I', struct.pack('<f', value))[0]:08x}"


def nearest_integer_positive(value: Fraction) -> int:
    if value < 0:
        raise ValueError("This analysis only expects positive coordinates")
    return math.floor(value + Fraction(1, 2))


def nearest_step_positive(value: Fraction, step: Fraction) -> Fraction:
    return Fraction(nearest_integer_positive(value / step), 1) * step


def read_shapes(slide_xml: bytes) -> dict[str, dict[str, int]]:
    root = ET.fromstring(slide_xml)
    shapes: dict[str, dict[str, int]] = {}
    for shape in root.findall(".//p:sp", NS):
        name_node = shape.find("./p:nvSpPr/p:cNvPr", NS)
        offset_node = shape.find("./p:spPr/a:xfrm/a:off", NS)
        if name_node is None or offset_node is None:
            continue
        name = name_node.attrib["name"]
        entry = {"x": int(offset_node.attrib["x"]), "y": int(offset_node.attrib["y"])}
        tab_node = shape.find("./p:txBody/a:p/a:pPr/a:tabLst/a:tab", NS)
        if tab_node is not None:
            entry["tabPosition"] = int(tab_node.attrib["pos"])
        shapes[name] = entry
    return shapes


def main() -> int:
    parser = argparse.ArgumentParser()
    bundle_root = Path(__file__).resolve().parent
    parser.add_argument(
        "--report",
        type=Path,
        default=bundle_root / "inputs" / "native-tab-v2-04-report.json",
        help="retained exact-byte native-tab-v2-04 report",
    )
    parser.add_argument(
        "--slide-xml",
        type=Path,
        default=bundle_root / "inputs" / "native-tab-v2-04-slide1.xml",
        help="exact ppt/slides/slide1.xml bytes extracted from the retained PPTX",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=bundle_root / "supporting-data.json",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="explicitly replace an existing output (default: refuse)",
    )
    args = parser.parse_args()

    if args.output.exists() and not args.overwrite:
        parser.error(
            f"refusing to overwrite existing analysis output without --overwrite: {args.output}"
        )

    report_path = args.report.resolve()
    slide_xml_path = args.slide_xml.resolve()
    raw_report = report_path.read_text(encoding="utf-8-sig")
    report = json.loads(raw_report)
    decimal_report = json.loads(raw_report, parse_float=Decimal)
    slide_xml = slide_xml_path.read_bytes()
    shapes = read_shapes(slide_xml)

    original = report["original"]["observation"]["records"]
    reopened = report["reopened"]["observation"]["records"]
    decimal_targets = decimal_report["requested"]["targets"]
    if len(original) != 9 or len(reopened) != 9 or len(decimal_targets) != 9:
        raise AssertionError("The retained control must contain exactly nine pairs")

    base_xml_x = shapes["tab-0"]["x"]
    base_xml_points = Fraction(base_xml_x, EMU_PER_POINT)
    rows: list[dict[str, object]] = []
    all_observations_stable = True
    all_tab_xml_nearest = True
    all_tab_com_matches_xml = True
    all_literal_xml_additive = True
    all_literal_com_matches_xml = True
    all_literal_character_matches_shape = True
    all_tab_text_matches_005_compatible_pattern = True

    relevant_fields = [
        "targetPoints",
        "tabStopPoints",
        "tabShapeLeft",
        "literalShapeLeft",
        "leadingTabBoundLeft",
        "leadingTabBoundWidth",
        "tabTextBoundLeft",
        "literalTextBoundLeft",
    ]

    for index, (record, reopened_record, decimal_target) in enumerate(
        zip(original, reopened, decimal_targets)
    ):
        target_decimal_fraction = fraction_from_decimal(decimal_target)
        target_float = float(record["targetPoints"])
        target_float32 = float32(target_decimal_fraction)
        tab_xml = shapes[f"tab-{index}"]["tabPosition"]
        literal_xml_x = shapes[f"literal-{index}"]["x"]

        nearest_target_emu = nearest_integer_positive(
            target_decimal_fraction * EMU_PER_POINT
        )
        nearest_float32_emu = nearest_integer_positive(
            Fraction.from_float(target_float32) * EMU_PER_POINT
        )
        tab_xml_points = Fraction(tab_xml, EMU_PER_POINT)
        literal_xml_points = Fraction(literal_xml_x, EMU_PER_POINT)
        expected_tab_com = float32(tab_xml_points)
        expected_literal_com = float32(literal_xml_points)

        snapped_005 = nearest_step_positive(
            target_decimal_fraction, FIVE_HUNDREDTH_POINT
        )
        expected_tab_text_absolute_fraction = base_xml_points + snapped_005
        nearest_absolute_005 = nearest_step_positive(
            base_xml_points + target_decimal_fraction, FIVE_HUNDREDTH_POINT
        )
        if nearest_absolute_005 != expected_tab_text_absolute_fraction:
            raise AssertionError("The 32.4 point base should make both 0.05 patterns coincide")
        expected_tab_text_absolute = float32(expected_tab_text_absolute_fraction)
        expected_leading_absolute = float32(base_xml_points)
        expected_tab_offset = expected_tab_text_absolute - expected_leading_absolute

        observation_stable = all(record[field] == reopened_record[field] for field in relevant_fields)
        tab_xml_nearest = tab_xml == nearest_target_emu == nearest_float32_emu
        tab_com_matches_xml = float(record["tabStopPoints"]) == expected_tab_com
        literal_xml_additive = literal_xml_x == base_xml_x + tab_xml
        literal_com_matches_xml = float(record["literalShapeLeft"]) == expected_literal_com
        literal_character_matches_shape = (
            float(record["literalTextBoundLeft"]) == float(record["literalShapeLeft"])
        )
        tab_text_matches_005_compatible_pattern = (
            float(record["tabTextBoundLeft"]) == expected_tab_text_absolute
        )

        all_observations_stable &= observation_stable
        all_tab_xml_nearest &= tab_xml_nearest
        all_tab_com_matches_xml &= tab_com_matches_xml
        all_literal_xml_additive &= literal_xml_additive
        all_literal_com_matches_xml &= literal_com_matches_xml
        all_literal_character_matches_shape &= literal_character_matches_shape
        all_tab_text_matches_005_compatible_pattern &= tab_text_matches_005_compatible_pattern

        actual_tab_offset = float(record["tabTextBoundLeft"]) - float(
            record["leadingTabBoundLeft"]
        )
        actual_literal_offset = float(record["literalTextBoundLeft"]) - float(
            record["tabShapeLeft"]
        )
        leading_width_minus_tab_offset = float(record["leadingTabBoundWidth"]) - actual_tab_offset

        rows.append(
            {
                "index": index,
                "target": {
                    "jsonDecimal": str(decimal_target),
                    "exactDecimalFraction": fraction_record(target_decimal_fraction),
                    "binary64": float_record(target_float),
                    "binary32Input": {
                        **float_record(target_float32),
                        "bits": float32_bits(target_float32),
                    },
                },
                "savedTabStop": {
                    "drawingMlInteger": tab_xml,
                    "exactPoints": fraction_record(tab_xml_points),
                    "nearestIntegerFromExactDecimalTarget": nearest_target_emu,
                    "nearestIntegerFromBinary32Target": nearest_float32_emu,
                    "matchesBothNearestIntegerPredictions": tab_xml_nearest,
                },
                "observedTabStop": {
                    **float_record(float(record["tabStopPoints"])),
                    "expectedBinary32FromDrawingMl": expected_tab_com,
                    "matchesExpected": tab_com_matches_xml,
                },
                "savedLiteral": {
                    "drawingMlX": literal_xml_x,
                    "exactPoints": fraction_record(literal_xml_points),
                    "tabShapeXPlusTabStop": base_xml_x + tab_xml,
                    "matchesAdditiveCoordinate": literal_xml_additive,
                },
                "observedLiteral": {
                    "shapeLeft": float_record(float(record["literalShapeLeft"])),
                    "characterBoundLeft": float_record(float(record["literalTextBoundLeft"])),
                    "expectedBinary32FromDrawingMl": expected_literal_com,
                    "shapeMatchesExpected": literal_com_matches_xml,
                    "characterMatchesShape": literal_character_matches_shape,
                    "offsetFromTabShape": float_record(actual_literal_offset),
                },
                "observedTabText": {
                    "leadingCharacterBoundLeft": float_record(
                        float(record["leadingTabBoundLeft"])
                    ),
                    "leadingCharacterBoundWidth": float_record(
                        float(record["leadingTabBoundWidth"])
                    ),
                    "textCharacterBoundLeft": float_record(
                        float(record["tabTextBoundLeft"])
                    ),
                    "offsetFromLeadingBoundLeft": float_record(actual_tab_offset),
                    "nearestFiveHundredthTarget": fraction_record(snapped_005),
                    "nearestFiveHundredthAbsolute": fraction_record(nearest_absolute_005),
                    "expectedAbsoluteBinary32": expected_tab_text_absolute,
                    "expectedOffsetAfterSeparateBinary32Coordinates": expected_tab_offset,
                    "matchesCompatibleNinePairPattern": tab_text_matches_005_compatible_pattern,
                    "relativeAndAbsolute005PredictionsCoincideBecauseBaseIsOnGrid": True,
                    "leadingBoundWidthMinusStartOffset": float_record(
                        leading_width_minus_tab_offset
                    ),
                },
                "originalAndReopenedRelevantFieldsExact": observation_stable,
            }
        )

    phase_metrics_equal = report["metrics"]["original"] == {
        **report["metrics"]["reopened"],
        "phase": "original",
    }
    result = {
        "schema": "opf-pptx-native-tab-quantization-analysis-v1",
        "scope": "Offline analysis of the retained native-tab-v2-04 JSON observations and saved DrawingML only.",
        "inputs": {
            "report": {
                "path": report_path.relative_to(bundle_root).as_posix(),
                "sha256": sha256(report_path),
            },
            "slideXml": {
                "path": slide_xml_path.relative_to(bundle_root).as_posix(),
                "sourceZipMember": "ppt/slides/slide1.xml",
                "sha256": sha256_bytes(slide_xml),
            },
        },
        "coordinateConvention": {
            "drawingMlIntegerUnitsPerPoint": EMU_PER_POINT,
            "tabTextObservedStepTestedPoints": fraction_record(FIVE_HUNDREDTH_POINT),
            "tabShapeDrawingMlX": base_xml_x,
            "tabShapeExactPoints": fraction_record(base_xml_points),
            "tabShapeObservedBinary32": float_record(float(original[0]["tabShapeLeft"])),
        },
        "checks": {
            "originalReopenedRelevantObservationsExactAllNine": all_observations_stable,
            "originalReopenedPhaseMetricsExact": phase_metrics_equal,
            "savedTabStopIsNearestDrawingMlIntegerAllNine": all_tab_xml_nearest,
            "observedTabStopIsBinary32OfSavedCoordinateAllNine": all_tab_com_matches_xml,
            "savedLiteralXEqualsTabShapeXPlusSavedTabStopAllNine": all_literal_xml_additive,
            "observedLiteralShapeIsBinary32OfSavedCoordinateAllNine": all_literal_com_matches_xml,
            "literalCharacterBoundLeftEqualsLiteralShapeLeftAllNine": all_literal_character_matches_shape,
            "tabTextBoundLeftMatches005PointCompatiblePatternAllNine": all_tab_text_matches_005_compatible_pattern,
        },
        "distinctObservedTabTextOffsets": sorted(
            {
                float(record["tabTextBoundLeft"])
                - float(record["leadingTabBoundLeft"])
                for record in original
            }
        ),
        "retainedMetricOutcome": {
            "tolerancePoints": report["metrics"]["tolerancePoints"],
            "tabGatePassed": report["metrics"]["original"]["tabGatePassed"],
            "literalGatePassed": report["metrics"]["original"]["literalGatePassed"],
            "pairAgreementGatePassed": report["metrics"]["original"]["pairAgreementGatePassed"],
            "maximumTabErrorPoints": report["metrics"]["original"]["maximumTabErrorPoints"],
            "maximumLiteralErrorPoints": report["metrics"]["original"]["maximumLiteralErrorPoints"],
            "maximumPairDeltaPoints": report["metrics"]["original"]["maximumPairDeltaPoints"],
        },
        "rows": rows,
        "limits": [
            "The nine pairs establish these equalities for this retained run only.",
            "The data do not identify the undocumented implementation step that produces the observed tab-text character positions.",
            "Because the 32.4 point tab-shape base is itself on the 0.05 point grid, the rows cannot distinguish a relative-distance pattern from an absolute-position pattern.",
            "No compensation, changed tolerance, or broader mixed-size/table behavior is evaluated.",
        ],
    }

    required_checks = list(result["checks"].values())
    if not all(required_checks):
        failed = [name for name, passed in result["checks"].items() if not passed]
        raise AssertionError(f"Analysis check failed: {failed}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n"
    )
    print(
        json.dumps(
            {
                "passed": True,
                "rows": len(rows),
                "checks": len(required_checks),
                "output": str(args.output.resolve()),
                "sha256": sha256(args.output),
            },
            separators=(",", ":"),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
