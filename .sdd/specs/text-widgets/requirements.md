# Requirements Document

## Project Description (Input)
Source: `Trumpet Technical Challenge 2026.pdf` (provided by Trumpet)

**Context:** Trumpet helps companies sell using digital sales rooms called "pods" — personalised micro-sites containing documents, images, video, text, etc. Sellers customise pods with widgets (e.g. YouTube embeds, text). Reference: https://intercom.help/trumpet/en/articles/6389888-how-do-i-add-text-to-a-pod

**Challenge:** Build a web application with minimal styling where a user can add one or more basic text widgets by clicking a button. Each widget accepts a plain string of text (no formatting/fonts needed) and has a border around it. Reusable elements (e.g. input boxes, buttons) must be reusable components. Text is not shared between widgets — each widget is an independent entity. When the user is done typing, the widget's text is sent to the backend to be stored. After a page refresh, the same widgets are repopulated with the same text.

**Requirements:**
- The user can add widgets.
- Handles large strings of text (e.g. 1000 characters).
- Unit tests using a unit testing framework.
- README.md with instructions to run the app and tests (may include AI prompts used).
- Version control (Git) with commit history.
- Explanation of the approach and choices made.
- Upload to a public code repository and share the link with the reviewer by email.

**Evaluation:** Correctness, efficiency (time/space complexity), code quality, testing, documentation.

**Bonus (optional):** Delete widgets; Docker container; discussion of tradeoffs; discussion of what would be done with more time; additional features showcasing skills.

**Tips:** In-memory storage is acceptable for stored text; use a testing framework; keep README clear.

## Introduction
The Text Widgets feature delivers a minimally styled web application, modelled on a Trumpet "pod", in which a user can add, edit and (optionally) delete independent plain-text widgets. Each widget's text is saved to a backend automatically once the user stops typing, and the full set of widgets with their text is restored when the page is reloaded. The solution is delivered as a version-controlled repository with unit tests, a README describing how to run and test it, the approach taken, tradeoffs, and future improvements, and optionally a Docker setup.

Subjects used in acceptance criteria:
- **Widget App** — the browser-based user interface.
- **Widget Service** — the backend that stores and returns widgets.
- **Project Repository** — the delivered source code, tests and documentation.

## Requirements

### Requirement 1: Add Text Widgets
**Objective:** As a seller customising a pod, I want to add one or more text widgets by clicking a button, so that I can place several independent blocks of text on the page.

#### Acceptance Criteria
1. The Widget App shall display an "Add widget" button on the page.
2. When the user clicks the "Add widget" button, the Widget App shall add a new, empty text widget to the page.
3. When the user clicks the "Add widget" button multiple times, the Widget App shall add one new widget per click, with no fixed upper limit enforced by the user interface.
4. When a new widget is added, the Widget App shall display it after all existing widgets, preserving the order in which widgets were created.
5. When a new widget is added, the Widget Service shall persist the widget with a unique identifier so that it survives a page reload even if no text has been entered.
6. The Widget App shall display each text widget with a visible border around it.
7. While no widgets exist, the Widget App shall display an empty-state message prompting the user to add a widget.

### Requirement 2: Independent Text Editing
**Objective:** As a seller, I want each widget to hold its own text, so that editing one widget never changes the content of another.

#### Acceptance Criteria
1. The Widget App shall provide a plain-text input area within each text widget.
2. When the user types into a widget's input area, the Widget App shall update only that widget's text.
3. The Widget App shall keep the text of every widget independent, such that no two widgets share or mirror content.
4. The Widget App shall accept plain text only and shall not offer formatting, font or styling controls.
5. The Widget App shall preserve line breaks and whitespace entered by the user within a widget's text.

### Requirement 3: Save Text When the User Is Done Typing
**Objective:** As a seller, I want my text saved automatically when I stop typing, so that I do not need a manual save action and do not lose work.

#### Acceptance Criteria
1. When the user stops typing in a widget for a defined inactivity period (no more than 1 second), the Widget App shall send that widget's current text to the Widget Service.
2. When the user moves focus out of a widget with unsaved changes, the Widget App shall send that widget's current text to the Widget Service without waiting for the inactivity period.
3. While the user is continuously typing in a widget, the Widget App shall not send a save request for every keystroke.
4. When a save is triggered, the Widget App shall send only the text of the widget that changed, not the text of all widgets.
5. If a widget's text is unchanged since its last successful save, the Widget App shall not send a save request for that widget.
6. If multiple save requests for the same widget are in flight, the Widget App shall ensure that the most recently typed text is the value finally stored.
7. When the Widget Service receives a valid save request for an existing widget, the Widget Service shall store the provided text for that widget and return the updated widget.
8. The Widget App shall display a per-widget save status indicating at least "saving", "saved" and "error" states.

### Requirement 4: Restore Widgets After Page Reload
**Objective:** As a seller, I want the same widgets and text to reappear after I refresh the page, so that my pod content persists between visits.

#### Acceptance Criteria
1. When the Widget App loads, the Widget App shall request all stored widgets from the Widget Service.
2. When the stored widgets are returned, the Widget App shall render each widget with exactly the text last saved for it.
3. When the stored widgets are returned, the Widget App shall render them in their original creation order.
4. While stored widgets are being loaded, the Widget App shall display a loading indicator.
5. If the stored widgets cannot be loaded, the Widget App shall display an error message and offer the user a way to retry.
6. The Widget Service shall retain stored widgets for as long as the Widget Service process is running, using in-memory storage as a minimum.

### Requirement 5: Large Text Support
**Objective:** As a seller, I want to enter long passages of text, so that a widget can hold substantial content such as a product description.

#### Acceptance Criteria
1. The Widget App shall allow the user to enter at least 10,000 characters of text in a single widget.
2. When a widget containing at least 1,000 characters is saved and the page is reloaded, the Widget App shall display the identical text, character for character.
3. The Widget Service shall accept and store widget text of at least 10,000 characters.
4. If a save request contains text exceeding the Widget Service's maximum allowed length, the Widget Service shall reject the request with a validation error and leave the previously stored text unchanged.
5. The Widget App shall correctly store and restore text containing Unicode characters (e.g. accented letters and emoji).
6. While a widget contains large text, the Widget App shall remain responsive to typing in that widget and in other widgets.

### Requirement 6: Delete Text Widgets (Bonus)
**Objective:** As a seller, I want to remove widgets I no longer need, so that my pod contains only relevant content.

#### Acceptance Criteria
1. Where widget deletion is included, the Widget App shall display a delete control on each text widget.
2. Where widget deletion is included, when the user activates a widget's delete control, the Widget App shall remove that widget from the page and request its deletion from the Widget Service.
3. Where widget deletion is included, when the Widget Service receives a delete request for an existing widget, the Widget Service shall remove the widget so that it is not returned after a page reload.
4. Where widget deletion is included, when a widget is deleted, the Widget App shall leave all other widgets and their text unchanged.
5. Where widget deletion is included, if the deletion request fails, the Widget App shall restore the widget on the page and display an error message.
6. Where widget deletion is included, when a widget with a pending save is deleted, the Widget App shall cancel the pending save for that widget.

### Requirement 7: Widget Service Interface and Validation
**Objective:** As a frontend developer, I want a clear and validated backend interface, so that widget data is stored consistently and errors are reported predictably.

#### Acceptance Criteria
1. The Widget Service shall provide operations to list all widgets, create a widget, update a widget's text and delete a widget.
2. The Widget Service shall represent each widget with at least a unique identifier, its text, and creation and last-updated timestamps.
3. If a request references a widget identifier that does not exist, the Widget Service shall respond with a not-found error.
4. If a request body is malformed or the text field is not a string, the Widget Service shall respond with a validation error and shall not modify stored data.
5. The Widget Service shall look up, update and delete a single widget in constant time relative to the number of stored widgets.
6. The Widget Service shall exchange data with the Widget App in JSON format.

### Requirement 8: Reusable Components and Minimal Styling
**Objective:** As a reviewer assessing code quality, I want reusable UI building blocks and minimal styling, so that the code is organised, readable and easy to extend with new widget types.

#### Acceptance Criteria
1. The Widget App shall implement buttons as a single reusable button component used for every button in the interface.
2. The Widget App shall implement the text input area as a reusable input component that is not specific to the text widget.
3. The Widget App shall implement the bordered widget container as a reusable component that could host other widget types.
4. The Widget App shall apply minimal styling, limited to layout, spacing, borders and status indicators.
5. The Widget App shall provide accessible labels for interactive controls (buttons and text inputs).

### Requirement 9: Automated Testing
**Objective:** As a reviewer, I want unit tests written with a testing framework, so that I can verify the solution behaves correctly.

#### Acceptance Criteria
1. The Project Repository shall include unit tests for the Widget Service covering list, create, update, delete, not-found and validation behaviour.
2. The Project Repository shall include unit tests for the Widget App covering adding widgets, independent editing, save-on-done-typing behaviour, restoring widgets on load, and deletion.
3. The Project Repository shall include a test verifying that a widget text of at least 1,000 characters is stored and returned unchanged.
4. The Project Repository shall include tests for each reusable UI component.
5. When the documented test command is run, the Project Repository shall execute all tests and report their pass/fail status.

### Requirement 10: Documentation, Version Control and Delivery
**Objective:** As a reviewer, I want clear documentation and visible commit history, so that I can run the solution, understand the decisions made, and evaluate the development process.

#### Acceptance Criteria
1. The Project Repository shall include a README.md with step-by-step instructions to install dependencies, run the application and run the tests.
2. The Project Repository shall include in the README.md an explanation of the implementation approach and the key technical choices made.
3. The Project Repository shall include in the README.md a discussion of the tradeoffs made.
4. The Project Repository shall include in the README.md a section describing what would be done with more time.
5. The Project Repository shall include in the README.md the AI prompts or AI-assisted workflow used to produce the solution.
6. The Project Repository shall be managed with Git and shall contain an incremental commit history reflecting the development steps.
7. Where Docker support is included, the Project Repository shall provide a Docker configuration that starts the full application with a single documented command.
8. The Project Repository shall be publishable to a public code repository without containing secrets or machine-specific configuration.
