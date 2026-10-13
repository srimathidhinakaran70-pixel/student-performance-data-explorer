# Student Performance Data Explorer

A responsive beginner-friendly data collection and exploration application for the **Collect a Dataset** Data Analytics internship task.

## Project objective
Demonstrate how structured student performance records can be collected, stored, validated, explored, and exported for analysis.

## Features
- Responsive dashboard with dynamically calculated KPIs and Chart.js visualizations
- Form for adding and editing student records with validation
- Dataset search, department/year filters, sorting, pagination, and delete confirmation
- CSV import with required-header checks, row validation, and import feedback
- CSV export of all records or the current filtered view
- Data-quality checks for missing values, invalid values, and duplicate IDs
- Browser `localStorage` persistence
- 24 fictional sample student records
- Separate HTML, CSS, and JavaScript files

## Technologies
- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js (loaded from jsDelivr CDN)
- Browser localStorage
- CSV import/export

## Dataset description
`sample-data.csv` contains fictional student records with these columns:

`id,name,department,year,attendance,marks,date`

All people and scores in the sample data are fictional and are provided for demonstration only.

## Run locally
1. Download or clone this repository.
2. Keep `index.html`, `style.css`, `script.js`, and `sample-data.csv` in the same folder.
3. Open `index.html` in a modern browser. Alternatively, use VS Code with the Live Server extension.
4. Open **About Project** and select **Load sample data**, or import `sample-data.csv` from the Explore Dataset page.

An internet connection is needed for the Chart.js CDN and optional web fonts. The app itself uses no build step and requires no API keys.

## Test checklist
- [ ] Load sample data
- [ ] Add a record with valid fields
- [ ] Try an invalid attendance or marks value
- [ ] Try adding a duplicate student ID
- [ ] Refresh the browser and confirm records persist
- [ ] Search by name and ID
- [ ] Filter by department and year
- [ ] Sort marks and attendance
- [ ] Edit a record and delete a record
- [ ] Import `sample-data.csv`
- [ ] Import a CSV with missing headers and check the error
- [ ] Export the full dataset and a filtered view
- [ ] Review Data Quality
- [ ] Test the layout at mobile and desktop widths

## Screenshots
Add screenshots of the Dashboard, Collect Data form, Explore Dataset table, and Data Quality report here after running the application.

## Publish using GitHub Pages
1. Create a GitHub repository, for example `student-performance-data-explorer`.
2. Upload the project files to the repository root and commit them.
3. Go to **Settings → Pages**.
4. Under build and deployment, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
5. Wait for the Pages deployment to complete and open the published URL.

This is a static frontend application, so it can be hosted on GitHub Pages.

## Database integration readiness
This version stores records in the current browser's `localStorage`. It does **not** connect to a remote database, and local browser data is not shared between devices or users.

For a future Supabase integration:
1. Create a Supabase project and a `students` table with columns matching the dataset fields.
2. Configure Row Level Security and suitable policies before exposing any user data.
3. Replace the `loadRecords()` and `saveRecords()` localStorage logic in `script.js` with Supabase queries. Convert the flow to async/await and handle loading/error states.
4. Keep the Supabase anon/publishable key in frontend configuration only; never expose a service-role key or other secret in browser code.
5. Test authentication, access rules, inserts, updates, and deletes before describing the project as database-connected.

## Known limitations
- No real backend/database is connected in this version.
- Browser localStorage is device/browser-specific.
- Chart.js and web fonts are fetched from external CDNs.
- The sample dataset is fictional and not intended for real academic decisions.
