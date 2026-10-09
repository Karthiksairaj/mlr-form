RINVOQ live inspection, 2026-09-28

No personal data entered and no form submitted. No production source changed.

First visit: the native select became visible at 19,735 ms. It was in the main
document, enabled, display:block, visibility:visible, 375 by 43 pixels, with
11 options including the placeholder. ID: dropdown-d43a22c603-widget;
name: indicationDropdown. No excluded header/navigation ancestor was found.

Eight successive calls to the production extractor returned empty arrays,
each taking approximately 1,000–1,015 ms (the scan budget). The subsequent
screenshot timed out at 10 seconds. These results do not establish which
part of the pending extraction was slow.

The previously downloaded embedded form HTML contains 803 inputs, 22 selects,
and 838 labels, including hidden branches. The scanner checks these controls.

Second visit: the dropdown was not observed within the approximately
170-second inspection window, so the stage-level profile did not run. The
inspection.json file is from this second attempt. The first measurements
above were captured in tool output before that file was overwritten.

Conclusion: the control is an ordinary visible native select compatible with
the extraction rules. Loading varies between visits, and pending extraction
can prevent the runner from returning a select already visible on the page.
The exact expensive operation is not yet isolated.
