"""
Export utilities for reports to CSV and Excel formats.

Converts report data to downloadable file formats.
"""
import io
from typing import List, Dict, Any
from datetime import datetime
import pandas as pd
from fastapi.responses import StreamingResponse


def flatten_report_data(data: Any, prefix: str = "") -> List[Dict[str, Any]]:
    """
    Flatten nested report data for export.

    Args:
        data: Report data (can be dict, list, or Pydantic model)
        prefix: Prefix for nested keys

    Returns:
        List of flattened dictionaries
    """
    # Handle Pydantic models
    if hasattr(data, 'model_dump'):
        data = data.model_dump()

    # Handle list of items
    if isinstance(data, list):
        return [flatten_dict(item) for item in data]

    # Handle single dict
    if isinstance(data, dict):
        return [flatten_dict(data)]

    return []


def flatten_dict(d: Dict[str, Any], parent_key: str = "", sep: str = "_") -> Dict[str, Any]:
    """
    Recursively flatten a nested dictionary.

    Args:
        d: Dictionary to flatten
        parent_key: Parent key for nested items
        sep: Separator between parent and child keys

    Returns:
        Flattened dictionary
    """
    items = []

    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k

        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # Convert list to comma-separated string
            if v and isinstance(v[0], dict):
                # For list of dicts, skip or summarize
                items.append((new_key, f"{len(v)} items"))
            else:
                items.append((new_key, ", ".join(map(str, v))))
        else:
            items.append((new_key, v))

    return dict(items)


def create_csv_response(data: Any, filename: str) -> StreamingResponse:
    """
    Create CSV file response from report data.

    Args:
        data: Report data
        filename: Output filename (without extension)

    Returns:
        StreamingResponse with CSV file
    """
    # Convert to DataFrame
    flattened = flatten_report_data(data)
    df = pd.DataFrame(flattened)

    # Create CSV in memory
    output = io.StringIO()
    df.to_csv(output, index=False, encoding='utf-8-sig')  # BOM for Excel compatibility
    output.seek(0)

    # Create response
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}.csv"
        }
    )


def create_excel_response(data: Any, filename: str, sheet_name: str = "Report") -> StreamingResponse:
    """
    Create Excel file response from report data.

    Args:
        data: Report data
        filename: Output filename (without extension)
        sheet_name: Excel sheet name

    Returns:
        StreamingResponse with Excel file
    """
    # Convert to DataFrame
    flattened = flatten_report_data(data)
    df = pd.DataFrame(flattened)

    # Create Excel in memory
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name=sheet_name, index=False)

        # Auto-adjust column widths
        worksheet = writer.sheets[sheet_name]
        for idx, col in enumerate(df.columns):
            max_length = max(
                df[col].astype(str).apply(len).max(),
                len(str(col))
            )
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_length + 2, 50)

    output.seek(0)

    # Create response
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}.xlsx"
        }
    )


def create_multi_sheet_excel_response(
    data_sheets: Dict[str, Any],
    filename: str
) -> StreamingResponse:
    """
    Create Excel file with multiple sheets.

    Args:
        data_sheets: Dictionary of {sheet_name: data}
        filename: Output filename (without extension)

    Returns:
        StreamingResponse with Excel file
    """
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for sheet_name, data in data_sheets.items():
            flattened = flatten_report_data(data)
            df = pd.DataFrame(flattened)
            df.to_excel(writer, sheet_name=sheet_name, index=False)

            # Auto-adjust column widths
            worksheet = writer.sheets[sheet_name]
            for idx, col in enumerate(df.columns):
                max_length = max(
                    df[col].astype(str).apply(len).max(),
                    len(str(col))
                )
                # Limit to reasonable width
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[chr(65 + idx)].width = adjusted_width

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}.xlsx"
        }
    )


def generate_export_filename(report_type: str, start_date=None, end_date=None) -> str:
    """
    Generate standardized filename for exports.

    Args:
        report_type: Type of report (e.g., 'tickets_summary')
        start_date: Optional start date
        end_date: Optional end date

    Returns:
        Formatted filename (without extension)
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{report_type}_{timestamp}"

    if start_date and end_date:
        filename = f"{report_type}_{start_date}_to_{end_date}"

    return filename
