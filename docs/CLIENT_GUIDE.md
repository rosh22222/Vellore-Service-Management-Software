# Daily workflow for Vellore Fitness Equipment

## When you sell products

1. Open **Bill Details → New Bill**.
2. Keep the suggested **Invoice No.**, or replace it with the number already given to your customer.
3. Select an existing customer, or choose **New Customer** and enter their details.
4. Add each purchased product. Use **Add Another Product** for additional products on the same bill.
5. Add warranty where applicable. Select its duration and start date; expiry fills automatically. Save the bill.

This is a record of the customer's purchase for service tracking. It does not issue a sales invoice.

Fields marked with a red **\*** are mandatory. Enter the Quantity for every new product; saving with a blank quantity shows **Please enter Quantity.** Notes and serial numbers are optional. When completing a service, enter **0** as the Service Amount for warranty/free work instead of leaving it blank.

### Several identical machines on one bill

- For five treadmills, leave the Quantity dropdown as **Unit** and enter **5**. Enter a separate serial for each machine if available; serials are optional.
- After saving, the bill retains one product line with quantity 5 and shows five individual machine cards. Each has its own equipment ID, warranty and service history.
- Identify the affected machine by its serial or equipment ID when registering a complaint. Without manufacturer serials, label the physical machines with their equipment IDs.
- Use a machine's **New Complaint** or **Machine / History** action. Repairs on another machine do not become this machine's previous service or repeat issue.
- Editing quantity preserves existing machine IDs. Increasing it adds machines; reducing it removes unused machines from the end only. A machine with complaint/service history cannot be removed by reducing quantity or deleting the bill.
- Edit an individual machine through its Equipment page. Before any complaint exists on a bill, shared bill product edits apply to all its machines; price-only edits preserve individual warranty changes.

### Products recorded by weight

- Select **Kg** inside the Quantity box, then enter the total weight, such as **25.5**. Up to two decimal places are supported.
- Enter **Price per Kg**. For example, 25.5 Kg at ₹100 per Kg is stored as ₹2,550.
- Serial-number inputs are not shown for Kg. The purchase is tracked as one grouped product for complaints and service history, not one machine per kilogram.
- Saved bills show the quantity with Unit/Units or Kg, and editing keeps the selected measurement.
- Unit/Kg can be changed on an unused bill. Once any product has complaint/service history, the bill is protected; record a separate purchase instead of rewriting that invoice.

## When a customer calls with a problem

1. Search **Bill Details** using the invoice number or customer details and open the bill.
2. Select the affected product, describe the problem, choose the visit date and assign a technician if you have permission.
3. Save the complaint. It appears in **Service Complaints** and the assigned technician's **My Jobs**.

For a customer who bought equipment elsewhere, open **Service Complaints → New Complaint**. Add the customer and select **Not Known** if the equipment is not registered yet; a purchase bill is not required. The office can register/link the equipment separately afterward.

The header also has **New Complaint**. On that form, select **Existing Equipment**, or choose **Not Known** if it has not been registered/identified yet. Add **Office Notes** and choose a **Technician** now, or leave Assign later. Notes are visible on the assigned technician's job. New equipment is registered separately through Bill Details/Equipment or office follow-up, not inside the incoming-call form.

## Editing a saved bill

1. Open **Bill Details** and click **Edit Bill** between Open Details and Delete.
2. The complete saved customer, invoice/date, products, prices and warranty details appear together. Correct the fields and add/remove products as needed.
3. Click **Save All Changes**. Customer edits also update the customer's saved profile; existing machine IDs are retained where applicable.

A bill cannot be edited once any of its products has a complaint/service history. This also applies if a complaint is raised after you opened the editor. If someone changes the bill/customer while you are editing, reopen the editor rather than overwriting their changes.

## Technician sign-in

Email is required when adding/editing a technician. The technician can sign in with **Email + Password** or **Username + Password**. Updating a profile keeps its login email synchronized. Leave New Password blank when editing if the current password should stay unchanged.

## During a repair

1. The technician opens **My Jobs**, selects the job and reviews previous service history.
2. Save the inspection findings and actual problem found.
3. Add the work done. Update the job status if a visit, part or customer decision is pending.
4. When finished, enter completion notes, the service amount and any payment received now. Complete the service.

Completion creates permanent service history. A later problem gets a new complaint, preserving the previous repair details.

## Payments and reports

- **Service Collections** shows the charge, payments received and balance for each completed service. Record later payments here with payment mode and collector.
- A free warranty repair can have a service amount of zero.
- **Service History** shows past repairs and provides the service report PDF.
- **Reports** provides period summaries and CSV/PDF exports. Cash received in a period and the outstanding balance of that period's services are different measures.

## Correcting details

- Open a saved bill to **Edit Bill**, **Add Product**, or edit a product. You do not need to delete and recreate it.
- Changes to a linked product are reflected in equipment details, and equipment edits update its bill item.
- Unused bills/products can be deleted. Records linked to complaints or service history are protected so past work and payments remain traceable.
- Deleting an unused bill does not delete its shared customer.
- **Team Management** controls technician profiles and office accounts. Administrator access is needed for account management.

Wait for the saving indicator and confirmation before submitting again. If validation fails, correct the message shown below the form; your entered information stays in place.
