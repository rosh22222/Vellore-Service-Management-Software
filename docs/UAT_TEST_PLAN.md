# Client UAT test plan

Run these checks before handing the system to Vellore Fitness Equipments.

## Authentication / access

1. Admin login succeeds and sees all modules.
2. Office Staff login sees office modules but Admin-only user/settings controls remain protected server-side.
3. Technician login sees My Jobs and cannot open an unassigned/other-technician job directly.
4. Disabled users cannot log in.

## Customer / equipment

5. Create a Gym customer with phone/address.
6. Add multiple equipment under the same customer.
7. Open an equipment profile and verify warranty status from expiry date.
8. Search equipment by model and serial number.

## Complaint / assignment

9. Register five complaints for different customers in sequence; verify unique complaint numbers.
10. Verify all five appear on Technician Assignment without opening separate technician screens.
11. Assign one complaint; verify technician, assignment time and assigning user are stored.
12. Reassign the same complaint; verify old assignment remains in history with reason.

## Technician workflow

13. Login as assigned technician; verify previous services for the same equipment are visible before work.
14. Save inspection findings and Actual Problem Found separately from Customer Complaint.
15. Add Work Done and service notes.
16. Describe the repair/replacements in Work Done and completion notes; no separate parts-entry screen is required.
17. Enter the service amount and any amount collected now.
18. Complete service and verify a new permanent service number is created.

## Permanent history

19. Create another complaint for the same equipment and verify the previous completed service remains unchanged.
20. Confirm equipment timeline shows installation and both service events chronologically.
21. Confirm completed service record has customer/equipment/technician/warranty snapshots.
22. Attempt to modify completed service through technician workflow; verify it is blocked.

## Service collections / report

23. Open Service Collections and verify paid, partial and pending balances.
24. Add a later payment and verify amount, mode, collected-by user and notes are saved.
25. Download Service Report PDF and verify branding/customer/equipment/complaint/problem/work/parts/technician/service amount/collection balance.

## Reports

26. Check Today, Yesterday, This Week, This Month and custom report periods.
27. Export report CSV and PDF.
28. Verify technician-wise, warranty, collection and frequently serviced equipment reports.
29. Verify repeat-problem indicator appears when new wording matches previous service wording.

## Production handover

30. Replace seed/demo passwords.
31. Add actual company address, phone, GST and website.
32. Test with at least 3 staff accounts and 5 technician accounts.
33. Test on desktop, tablet and mobile.
34. Take a database backup and perform one test restore before go-live.
