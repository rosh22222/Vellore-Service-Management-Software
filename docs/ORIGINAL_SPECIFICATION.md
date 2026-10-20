Build a complete production-ready **Service Management Software for VELLORE FITNESS EQUIPMENTS**.

The software is for managing fitness equipment service complaints, technicians, customer equipment, repairs, service history, spare parts, billing, warranty, and reports.

The MOST IMPORTANT purpose of this software is:

Whenever a customer contacts Vellore Fitness Equipments with a service problem, the owner/staff should register the complaint, assign it to a technician, and after the technician completes the work, the complete details of that service must be permanently stored.

If the same customer or same equipment has another problem later, staff and technicians must immediately be able to see all previous services, previous problems, work done, parts changed, technicians involved, dates, charges and notes.

Do not build this as only a complaint management application.

It must be:

CUSTOMER → EQUIPMENT → COMPLAINT → TECHNICIAN ASSIGNMENT → INSPECTION → SERVICE WORK → PARTS → BILL → COMPLETION → PERMANENT SERVICE HISTORY.

---

# 1. USER ROLES

Create role-based access.

## ADMIN / OWNER

Admin can:

- View dashboard
- Create customers
- Edit customers
- Register customer equipment
- Create service complaints
- View all complaints
- Assign technicians
- Reassign technicians
- View all technicians on one assignment page
- View technician workloads
- Manage equipment
- View complete service history
- Manage spare parts
- View reports
- Manage users
- Manage technicians
- Manage settings

## OFFICE STAFF

Staff can:

- Add customer
- Add equipment
- Create complaint
- Search customer
- Search equipment
- Assign technician if permission is given
- View complaint status
- View service history
- Generate service reports/bills depending on permission

## TECHNICIAN

Technician can:

- Login using their own credentials
- View jobs assigned to them
- View customer information
- View customer address
- View equipment details
- View complaint raised by customer
- View previous service history of that equipment
- Start job
- Add inspection findings
- Add actual problem found
- Add work performed
- Add parts replaced
- Add service notes
- Add before/after images if required
- Change service status
- Mark service complete

Technicians must NOT be allowed to modify old completed service records without Admin authorization.

---

# 2. DASHBOARD

Create a clean professional dashboard.

Display cards:

- Total Customers
- Total Equipment
- New Complaints
- Unassigned Complaints
- Assigned Complaints
- In Progress Services
- Completed Today
- Pending Services
- Warranty Services
- Paid Services
- Technicians Available
- Technicians Busy

Show:

## Today's Service Complaints

Columns:

- Complaint ID
- Customer
- Equipment
- Problem
- Technician
- Status
- Priority
- Date
- Action

## Technician Workload

Example:

Ramesh
Today's Jobs: 3
Pending: 1
Completed: 2

Suresh
Today's Jobs: 5
Pending: 3
Completed: 2

## Recent Completed Services

Show latest completed service records.

---

# 3. CUSTOMER MANAGEMENT

Create a Customers module.

Customer fields:

- Customer ID
- Customer Type
  - Gym
  - Home Customer
  - Hotel
  - Apartment
  - Institution
  - Other
- Customer Name
- Primary Mobile
- Alternate Mobile
- Email
- Address
- Area
- City
- State
- PIN Code
- GST Number optional
- Notes
- Created Date

Customer profile must contain tabs:

- Overview
- Equipment
- Open Complaints
- Service History

Example:

Customer:
POWER GYM

Phone:
9876543210

Location:
Vellore

Equipment:
8

Open Complaints:
2

Completed Services:
14

---

# 4. CUSTOMER EQUIPMENT MANAGEMENT

This is extremely important.

Every equipment must belong to a particular customer.

One customer can have multiple equipment.

Equipment fields:

- Equipment ID
- Customer
- Equipment Name
- Category
- Brand
- Model Number
- Serial Number
- Purchase Date
- Invoice Number
- Installation Date
- Warranty Start Date
- Warranty Expiry Date
- Warranty Duration
- Location / Branch
- Equipment Status
- Notes
- Equipment Photo optional

Example:

Customer:
Power Gym

Equipment:
Treadmill

Model:
TM-500

Serial:
TM500-2026-445

Installation:
10 January 2026

Warranty:
10 January 2027

Every equipment page must have:

- Equipment details
- Warranty status
- Open complaints
- Complete previous service history
- Parts replaced history
- Previous technicians
- Previous bills
- Service timeline

---

# 5. SERVICE COMPLAINT REGISTRATION

When customers call the Vellore Fitness Equipments office, Admin/Owner/Staff must be able to quickly create complaints.

Create a very fast "New Service Complaint" form.

Fields:

- Complaint ID auto-generated
- Complaint Date
- Customer
- Customer Phone
- Customer Address
- Select Equipment
- Equipment Model
- Serial Number
- Customer Complaint / Problem Reported
- Complaint Category
- Priority
- Preferred Visit Date optional
- Notes
- Complaint Source:
  - Phone
  - Walk-in
  - Email
  - Other

Priority:

- Low
- Normal
- High
- Urgent

Initial status:

UNASSIGNED

Example:

Complaint ID:
VFE-SRV-0001

Customer:
Power Gym

Equipment:
TM-500 Treadmill

Customer Complaint:
"Treadmill is making heavy noise while running."

Priority:
Normal

Status:
Unassigned

---

# 6. BULK DAILY COMPLAINT HANDLING

The software must support many customer calls per day.

Example:

Customer 1:
Power Gym
Treadmill stopping automatically

Customer 2:
FitZone
Cross Trainer making noise

Customer 3:
Ravi
Exercise Bike display not working

Customer 4:
Muscle Factory
Treadmill belt slipping

Customer 5:
Home Customer
Motor not starting

Each complaint must be individually saved with its own complaint number.

Owner should then be able to assign technicians easily.

---

# 7. TECHNICIAN MANAGEMENT

Create a Technician module.

Technician fields:

- Technician ID
- Name
- Mobile Number
- Email optional
- Address
- Skills
- Specialization
- Joining Date
- Active / Inactive
- Login Username
- Login Role
- Current Work Status

Possible status:

- Available
- Busy
- On Leave
- Inactive

Technician profile must show:

- Today's Jobs
- Pending Jobs
- In Progress Jobs
- Completed Jobs
- Total Services
- Recent Customers
- Performance/service statistics

---

# 8. TECHNICIAN ASSIGNMENT PAGE — VERY IMPORTANT

Create a dedicated page named:

"Technician Assignment"

This is one of the most important screens.

The owner should NOT need to open different screens to find technicians.

On ONE PAGE, show all unassigned complaints and ALL technicians.

Layout suggestion:

LEFT SIDE:
Unassigned Complaints

RIGHT SIDE:
Technician List

For each technician show:

- Technician Name
- Mobile
- Available / Busy
- Jobs Today
- Pending Jobs
- In Progress Jobs
- Completed Jobs Today

Example:

Complaint:

VFE-SRV-0001

Power Gym

TM-500 Treadmill

Problem:
Treadmill stopping automatically

Location:
Vellore

Priority:
High

Available Technicians:

Ramesh
Today: 3 Jobs
Pending: 1
Status: Available
[ASSIGN]

Suresh
Today: 5 Jobs
Pending: 2
Status: Busy
[ASSIGN]

Kumar
Today: 1 Job
Pending: 0
Status: Available
[ASSIGN]

Arjun
Today: 4 Jobs
Pending: 1
Status: Available
[ASSIGN]

When owner clicks:

KUMAR → ASSIGN

Update complaint:

Assigned Technician:
Kumar

Status:
Technician Assigned

Store:

- Assigned By
- Assigned Date
- Assigned Time
- Technician ID

Allow reassigning the technician with reason logging.

---

# 9. SERVICE STATUS FLOW

Use clear service stages.

Recommended statuses:

1. Complaint Received
2. Unassigned
3. Technician Assigned
4. Technician Accepted
5. Technician Visiting
6. Inspection Started
7. Problem Diagnosed
8. Repair In Progress
9. Waiting for Spare Part
10. Waiting for Customer Approval
11. Service Completed
12. Closed
13. Cancelled

Store every status update with:

- Previous Status
- New Status
- Changed By
- Date
- Time
- Notes

Create a complete activity timeline.

---

# 10. TECHNICIAN JOB SCREEN

When technician opens an assigned job, display:

CUSTOMER DETAILS

- Name
- Phone
- Address
- Location

EQUIPMENT DETAILS

- Equipment
- Brand
- Model
- Serial Number
- Warranty Status

CUSTOMER COMPLAINT

Clearly display exactly what the customer told the office.

Example:

Customer Complaint:
"Treadmill making heavy noise while running."

Then technician fills:

## Inspection Findings

Example:

"Drive belt loose and motor belt alignment incorrect."

## Actual Problem Found

This must be separate from customer complaint.

Customer Complaint:
Machine making noise.

Actual Problem:
Drive belt loose.

## Work Done

Example:

- Drive belt tightened
- Motor belt aligned
- Lubrication completed
- Treadmill tested for 20 minutes

## Technician Notes

Any extra notes.

---

# 11. PARTS / SPARES USED

Technician must be able to add parts used during service.

Fields:

- Part Name
- Part Code
- Quantity
- Unit Price
- Amount
- Warranty applicable
- Old Part Returned Yes/No
- Remarks

Example:

Motor Belt
Qty: 1
₹1,200

Lubrication Oil
Qty: 1
₹300

If no part changed:

"No Parts Replaced"

must be available.

---

# 12. WARRANTY MANAGEMENT

Automatically calculate warranty status.

Example:

Installation:
10 January 2026

Warranty Expiry:
10 January 2027

Service Date:
24 September 2026

Display:

UNDER WARRANTY

After warranty expires:

OUT OF WARRANTY

Allow Admin to manually adjust warranty if necessary.

Store warranty snapshot against every service so historical records remain accurate.

---

# 13. SERVICE CHARGES AND COLLECTIONS

After the technician solves the complaint, allow the office/technician to record the service amount and the amount collected, if any. Pending collections can be recorded later from Service Collections.

Useful fields:

- Service Charge
- Visiting Charge
- Parts Charge
- Labour Charge
- Other Charges
- Discount
- Tax if applicable
- Service Amount
- Amount Collected
- Payment Mode
- Collected By

Example:

Service Charge: ?500
Motor Belt: ?1,200
Lubrication: ?300

Amount Collected:
?2,000

---

# 14. SERVICE COMPLETION

Before marking service completed, require:

- Problem Found
- Work Done
- Parts Used / No Parts Used
- Technician
- Service Date
- Completion Notes

Optional:

- Customer Signature
- Before Photo
- After Photo

Once completed:

Create a permanent Service Record.

---

# 16. SERVICE REPORT PDF

Generate a professional printable PDF.

Header:

VELLORE FITNESS EQUIPMENTS

SERVICE REPORT

Include:

- Service Number
- Complaint Number
- Customer
- Phone
- Address
- Equipment
- Model
- Serial Number
- Warranty Status
- Complaint Reported
- Problem Found
- Work Done
- Parts Replaced
- Technician
- Service Date
- Charges
- Notes
- Customer Signature
- Technician Signature

Add Vellore Fitness Equipments branding.

---

# 17. PERMANENT SERVICE HISTORY — CORE FEATURE

This is the MOST IMPORTANT FUNCTION.

Never overwrite completed service records.

Every service must be saved permanently.

When a customer calls again, staff should search:

- Customer name
- Phone
- Equipment
- Model
- Serial Number

Then immediately see previous history.

Example:

POWER GYM

TM-500 TREADMILL

SERVICE #1

24 September 2026

Complaint:
Noise while running

Problem Found:
Drive belt loose

Work Done:
Drive belt tightened and aligned

Parts:
None

Technician:
Ramesh

---

SERVICE #2

15 December 2026

Complaint:
Machine stopping automatically

Problem Found:
Motor belt damaged

Work Done:
Motor belt replaced

Parts:
Motor Belt ₹1,200

Technician:
Suresh

---

SERVICE #3

10 March 2027

Complaint:
Display not working

Problem Found:
Display cable damaged

Work Done:
Display cable replaced

Technician:
Kumar

Technician must be able to view this history before starting the new service.

---

# 18. EQUIPMENT SERVICE TIMELINE

Create a visual chronological timeline.

Example:

TM-500 TREADMILL

Installed
10 Jan 2026

↓

SERVICE #1
24 Sep 2026

Noise Problem
Drive Belt Adjusted

↓

SERVICE #2
15 Dec 2026

Stopping Problem
Motor Belt Replaced

↓

SERVICE #3
10 Mar 2027

Display Problem
Cable Replaced

This gives the company the complete life history of the machine.

---

# 19. SEARCH

Create universal search.

Search using:

- Customer Name
- Mobile Number
- Complaint Number
- Service Number
- Equipment
- Model Number
- Serial Number
- Technician Name
- Invoice Number

Example:

Search:
9876543210

Return:

Customer:
Power Gym

Equipment:
8

Open Complaints:
1

Previous Services:
14

---

# 20. COMPLAINT LIST PAGE

Columns:

- Complaint #
- Date
- Customer
- Phone
- Equipment
- Problem
- Technician
- Priority
- Status
- Age
- Actions

Filters:

- Date
- Status
- Technician
- Customer
- Equipment
- Priority
- Warranty
- Assigned/Unassigned

---

# 21. SERVICE HISTORY PAGE

Columns:

- Service #
- Date
- Customer
- Equipment
- Model
- Complaint
- Problem Found
- Work Done
- Technician
- Parts
- Amount
- Status

Allow clicking any record to view complete service details.

---

# 22. REPORTS

Create reports:

- Service Complaints Report
- Technician-wise Service Report
- Customer-wise Service Report
- Equipment-wise Service Report
- Pending Services
- Completed Services
- Warranty Services
- Out-of-Warranty Services
- Parts Used Report
- Revenue from Services
- Most Frequently Serviced Equipment
- Repeat Complaint Report
- Technician Workload Report

Date filters:

- Today
- Yesterday
- This Week
- This Month
- Custom Range

Allow export to:

- PDF
- Excel/CSV

---

# 23. DATABASE DESIGN

Use a proper relational database.

Suggested tables:

users

roles

customers

customer_equipment

technicians

service_complaints

service_assignments

service_inspections

service_work_logs

service_status_history

service_records

service_parts

spare_parts

equipment_service_history

company_settings

Important relationships:

Customer
→ Many Equipment

Customer
→ Many Complaints

Equipment
→ Many Complaints

Equipment
→ Many Service Records

Complaint
→ Technician Assignment

Complaint
→ Inspection

Complaint
→ Service Work

Service
→ Parts

Service
→ Permanent History

---

# 26. REPEAT PROBLEM INDICATOR

Add an intelligent feature.

When a new complaint is entered, check previous service history.

Example:

New Complaint:
"Treadmill making noise."

Previous Service:
"Noise while running – Drive belt adjusted."

Show:

"Similar issue found in previous service."

This is useful for diagnosing recurring equipment problems.

Do this using previous service-history matching initially.

Keep architecture ready for AI-based analysis later.

---

# 27. USER INTERFACE

UI should be:

- Modern
- Professional
- Simple
- Fast
- Desktop friendly
- Tablet friendly
- Mobile responsive
- Easy for non-technical office staff

Do not make screens unnecessarily complicated.

Use sidebar navigation.

Suggested sidebar:

Dashboard

Customers

Equipment

Service Complaints

Technician Assignment

Technicians

Service History

Spare Parts



Reports

Users

Settings

Logout

---

# 28. COLOUR / BRANDING

Use VELLORE FITNESS EQUIPMENTS branding.

Keep company settings configurable:

- Company Logo
- Company Name
- Address
- Phone
- Email
- GST
- Website
- Primary Color
- Secondary Color

Do not hard-code branding throughout the application.

Use centralized company settings.

---

# 29. TECH STACK

Build using a production-quality modern architecture.

Preferred:

Frontend:
Next.js
TypeScript
Tailwind CSS

Backend:
NestJS or clean Next.js server architecture

Database:
PostgreSQL

ORM:
Prisma

Authentication:
Secure credential-based authentication with role permissions

PDF:
Server-generated professional PDFs

Use proper:

- Validation
- Error handling
- Authentication
- Authorization
- Database constraints
- Pagination
- Search
- Filtering
- Logging
- Responsive UI
- Loading states
- Empty states
- Confirmation dialogs

Do not use fake localStorage as the primary database.

---

# 30. DATA SECURITY

Implement:

- Secure password hashing
- Session protection
- Role-based permissions
- Server-side authorization
- Input validation
- Database constraints

Technicians should only access the information necessary for their assigned work unless given permission.

---

# 31. IMPORTANT BUSINESS RULES

RULE 1:

Every service complaint must belong to a customer.

RULE 2:

Where possible, every service complaint must belong to a specific equipment.

RULE 3:

Customer Complaint and Technician Problem Found are TWO DIFFERENT FIELDS.

RULE 4:

Completed service history must never disappear.

RULE 5:

Old completed services must not be overwritten when a new service happens.

RULE 6:

One equipment can have unlimited service records.

RULE 7:

Before servicing equipment, technician should be able to view previous service history.

RULE 8:

Admin must be able to see all technicians together while assigning work.

RULE 9:

Store technician assignment history even when a job is reassigned.

RULE 10:

Every important status/action must contain date, time and user information.

---

# 32. MAIN REAL-WORLD WORKFLOW

Example:

Power Gym calls Vellore Fitness Equipments.

Customer says:

"Our treadmill stops automatically after 10 minutes."

STEP 1

Office staff searches Power Gym.

STEP 2

Select TM-500 Treadmill.

STEP 3

Create complaint:

VFE-SRV-0045

Problem:
Stops automatically after approximately 10 minutes.

STEP 4

Complaint appears on Technician Assignment page.

STEP 5

Owner sees:

Ramesh – 5 jobs
Suresh – 3 jobs
Kumar – 1 job

Owner assigns Kumar.

STEP 6

Kumar sees the job.

Before going, Kumar views previous service history.

Previous service says:

24 Sep 2026
Noise issue
Drive belt tightened.

STEP 7

Kumar visits customer.

Inspection finds:

Motor belt badly worn.

STEP 8

Technician records:

Problem Found:
Motor belt damaged.

Work Done:
Old belt removed and new motor belt installed.

Parts:
Motor Belt – 1

STEP 9

Technician tests machine and marks service completed.

STEP 10

Service report is generated.

STEP 11

This service becomes permanently available under:

Power Gym
→ TM-500
→ Service History

When Power Gym calls again months later, staff can immediately see both previous services.

---

# 33. DEVELOPMENT ORDER

Build the application in this order.

PHASE 1

- Project architecture
- Database
- Authentication
- Roles
- Company settings

PHASE 2

- Customers
- Equipment
- Customer profile
- Equipment profile

PHASE 3

- Service complaint creation
- Complaint list
- Complaint details
- Search

PHASE 4

- Technicians
- Technician Assignment Page
- Assignment/reassignment

PHASE 5

- Technician job screen
- Inspection
- Problem found
- Work done
- Status updates

PHASE 6

- Service history
- Equipment service timeline
- Repeat service visibility

PHASE 7

- Spare parts
- Warranty

PHASE 8

- Service charges
- Service report PDF

PHASE 9

- Dashboard
- Reports
- Filters
- Export

PHASE 10

- Performance
- Security
- Final testing

---

# 34. FINAL QUALITY REQUIREMENT

Do not create placeholder-only pages.

Do not create UI without database functionality.

Every module must work end-to-end.

Example:

Create Customer
→ Add Equipment
→ Create Complaint
→ Assign Technician
→ Technician Opens Job
→ Technician Adds Diagnosis
→ Add Work Done
→ Add Parts
→ Complete Service
→ Generate Report
→ View Permanent History
→ Create Another Complaint
→ See Previous History

This complete flow must work.

Before considering the project finished, test this full workflow with multiple customers, multiple equipment and multiple technicians.

The final result should be a professional **Vellore Fitness Equipments Service Management System** that allows the company to know the complete service life of every customer's fitness equipment.
