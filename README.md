# SmartFace: AIoT-Based Staff Management & Attendance System

> An AIoT-based employee management and attendance platform integrating face authentication, anti-spoofing, and fingerprint fallback.

## Overview

**SmartFace** is an AIoT-based staff management and attendance system designed to modernize traditional employee attendance workflows.

Traditional attendance methods such as RFID cards, ID cards, PINs, and passwords are convenient but have practical limitations. Cards can be lost, forgotten, borrowed, or shared, while passwords and PINs can be forgotten or disclosed. These approaches also introduce additional interaction steps and may become inefficient when many employees check in or check out simultaneously.

SmartFace uses **face authentication as the primary identity mechanism**, combined with **anti-spoofing** to reduce presentation attacks and **fingerprint authentication as a fallback mechanism**.

The project goes beyond face recognition itself by integrating authentication, attendance, employee management, working-hour tracking, and payroll-related data into a unified web/mobile platform.

---

## Motivation

The goal is not simply to identify a person from a camera.

The goal is to build a practical system that can answer:

> **Who is this employee, is the presented identity genuine, and should this interaction be recorded as a valid attendance event?**

The system is designed around several practical problems:

* Employees may lose, forget, or share attendance cards.
* Passwords and PINs are not directly tied to physical identity.
* Manual attendance processes are slower and harder to manage.
* Traditional systems may separate employee information, attendance records, and payroll data.
* Employees often depend on administrators to update personal information or biometric registration.
* A single authentication mechanism may fail under real-world conditions.

SmartFace addresses these issues through a unified biometric and employee-management platform.

---

## Key Features

### AI-Powered Face Attendance

* Face detection using a pretrained YOLO model.
* Face alignment and basic quality checking.
* Anti-spoofing/liveness detection.
* Face embedding using a pretrained face-recognition model.
* Vector similarity search for identity matching.
* Support for both **check-in and check-out**.

### Fingerprint Fallback

Fingerprint authentication provides an alternative when face authentication is temporarily unavailable or unsuitable, for example:

* Poor image quality.
* Face occlusion.
* Camera failure.
* Temporary recognition failure.

Attendance records store the authentication method used:

```text
FACE
FINGERPRINT
```

### Employee Management

Managers and administrators can:

* Add employees.
* Edit employee information.
* Disable or remove employees.
* Search and filter the employee list.
* Manage employee profiles.
* Enroll or update face data.
* Manage authentication status.

### Employee Self-Service

Employees can access their own account and:

* View personal information.
* View department and position.
* View working schedule.
* View check-in/check-out records.
* View attendance history.
* View total working hours.
* Update permitted profile information.
* Update or re-enroll face data.

### Attendance Management

The system records:

```text
Employee
Check-in
Check-out
Timestamp
Working hours
Authentication method
Device
Verification information
```

Managers can monitor:

* Attendance history.
* Late arrivals.
* Early departures.
* Missing check-in/check-out.
* Daily and monthly attendance.

### Payroll-Related Data

Attendance information can be used as an input to payroll calculations:

```text
Attendance
    ↓
Working Hours
    ↓
Late / Early Leave / Overtime
    ↓
Payroll
```

The V1 system focuses primarily on generating reliable attendance and working-hour data, while detailed payroll rules can be extended later.

---

## System Architecture

High-level V1 architecture:

```text
                         ┌──────────────────┐
                         │      Camera      │
                         │ Raspberry Pi /   │
                         │   IoT Device     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Face Detection   │
                         │ Pretrained YOLO  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Face Alignment   │
                         │ + Quality Check  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Anti-Spoofing    │
                         │ Trained Model    │
                         └────────┬─────────┘
                                  │
                              REAL FACE
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Face Embedding   │
                         │ Pretrained Model │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Vector Search    │
                         │ pgvector / Qdrant│
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Identity Decision│
                         └────────┬─────────┘
                                  │
                       ┌──────────┴──────────┐
                       ▼                     ▼
                   CHECK-IN              CHECK-OUT
                       │                     │
                       └──────────┬──────────┘
                                  ▼
                         ┌──────────────────┐
                         │ Attendance       │
                         │ Service          │
                         └────────┬─────────┘
                                  │
                                  ▼
                         Employee / Payroll
                           Management
```

Fallback authentication:

```text
Face Authentication
        │
        └── unavailable / failed
                    ↓
               Fingerprint
                    ↓
              Identity Verify
                    ↓
             Check-in / out
```

---

## AI Pipeline

The V1 AI pipeline contains three main components.

### 1. Face Detection

A pretrained YOLO model detects faces from camera frames.

```text
Camera Frame
    ↓
YOLO
    ↓
Face Bounding Box
```

The detector is not trained from scratch in V1.

### 2. Anti-Spoofing

Anti-spoofing is the main model trained specifically for this project.

```text
Face Crop
    ↓
Lightweight CNN
    ↓
REAL / SPOOF
```

Candidate lightweight backbones include:

* MobileNetV3
* EfficientNet-B0

The initial model is trained using public datasets.

Potential datasets:

* CelebA-Spoof
* OULU-NPU
* SiW-Mv2
* MSU-MFSD

The initial V1 strategy is to use public data only. Camera-specific data will only be collected if the first model performs poorly after deployment.

### 3. Face Embedding

A pretrained face-recognition model is used to convert a face into a biometric representation.

Candidate models include:

* ArcFace
* AdaFace

The resulting embedding is stored and searched using a vector database.

---

## Identity Management

Identity management is intentionally separated from the ML models.

Adding or deleting an employee should not require model retraining.

### Add Employee

```text
Create Employee
      ↓
Face Enrollment
      ↓
Generate Embeddings
      ↓
Store Embeddings
```

### Update Face

```text
New Face Samples
      ↓
Quality Check
      ↓
Anti-Spoofing
      ↓
Generate New Embeddings
      ↓
Update Vector Database
```

This allows an employee to update their face data after changes such as:

* Different hairstyle.
* Beard or shaved beard.
* Glasses.
* Significant appearance changes.
* Need for additional enrollment samples.

### Delete Employee

Recommended V1 approach:

```text
Employee
   ↓
INACTIVE / DELETED
   ↓
Deactivate related embeddings
```

Physical deletion can be handled separately according to the application's retention policy.

---

## Multiple Face Embeddings

Instead of storing only one vector per employee, SmartFace can maintain multiple enrollment samples:

```text
Employee A
 ├── frontal
 ├── left
 ├── right
 ├── smiling
 ├── glasses
 └── different lighting
```

During recognition:

```text
Query Face
    ↓
Embedding
    ↓
Top-K Vector Search
    ↓
Group by Employee
    ↓
Aggregate / Re-rank
    ↓
Identity Decision
```

This helps the system handle moderate appearance changes without retraining the face embedding model.

---

## User Roles

### Admin

Full system management:

* Employee management.
* Attendance management.
* Payroll-related management.
* Device management.
* Account and permission management.
* System configuration.

### Manager

Typical management functions:

* Employee list and profiles.
* Attendance monitoring.
* Working-hour information.
* Payroll-related attendance data.
* Device status.

### Employee

Self-service functions:

* Personal profile.
* Working information.
* Attendance history.
* Check-in/check-out records.
* Working hours.
* Face enrollment/update.

Role-based access control ensures employees can only access information they are authorized to view.

---

## Attendance Flow

### Check-in

```text
Employee arrives
      ↓
Camera detects face
      ↓
Quality check
      ↓
Anti-spoofing
      ↓
Face recognition
      ↓
Identity match
      ↓
CHECK-IN event
      ↓
Attendance database
```

### Check-out

```text
Employee leaves
      ↓
Camera detects face
      ↓
Quality check
      ↓
Anti-spoofing
      ↓
Face recognition
      ↓
Identity match
      ↓
CHECK-OUT event
      ↓
Attendance database
```

### Fingerprint Fallback

```text
Face authentication fails
             ↓
       Fingerprint scan
             ↓
       Identity verified
             ↓
        CHECK-IN / OUT
```

---

## Web / Mobile Application

The application is designed as an employee-management platform rather than only an attendance interface.

### Manager / Admin Dashboard

Main modules:

```text
Dashboard
Employees
Attendance
Working Hours
Payroll
Devices
Account / Permissions
```

### Employee Portal

Main modules:

```text
My Profile
My Schedule
My Attendance
My Working Hours
My Face
```

The employee portal reduces dependence on administrators for routine tasks such as viewing attendance or updating allowed profile/face information.

---

## Data Architecture

A practical V1 stack can use PostgreSQL together with pgvector.

```text
PostgreSQL
├── employees
├── attendance
├── users
├── payroll_records
├── devices
└── audit_logs

pgvector
└── face_embeddings
```

Example face embedding record:

```text
embedding_id
employee_id
embedding
model_version
quality_score
source
created_at
is_active
```

Model versioning is important so that embeddings generated by different face-recognition models are not mixed incorrectly.

---

## IoT Architecture

The system can use Raspberry Pi or another edge device as the interface to physical devices.

```text
Raspberry Pi / Edge Device
├── Camera
├── Fingerprint Reader
└── Network Communication
          │
          ▼
      Backend API
          │
    ┌─────┼─────┐
    ▼     ▼     ▼
    AI   DB   Vector Search
```

Depending on hardware constraints, AI inference can run on the edge device or on a backend/server.

---

## V1 Scope

### Included

* Pretrained YOLO face detection.
* Face alignment and quality checks.
* Self-trained anti-spoofing model.
* Pretrained face embedding model.
* Vector similarity search.
* Employee CRUD.
* Face enrollment.
* Face information update.
* Face-based check-in.
* Face-based check-out.
* Fingerprint fallback.
* Attendance history.
* Working-hour information.
* Manager/Admin interface.
* Employee interface.
* Payroll-related attendance data.
* IoT device integration.

### Not Required for V1

The following are intentionally reserved for future versions:

* Continual learning.
* Temporal liveness.
* Camera-specific model adaptation.
* Custom YOLO training.
* Training a face embedding model from scratch.
* Automatic hard-example mining.
* Advanced MLOps and model monitoring.

The purpose of V1 is to deliver a complete end-to-end system before introducing additional AI complexity.

---

## Future Extensions

### Continual Learning

Production data can be used to improve the system:

```text
Production
    ↓
Hard Samples
    ↓
Human Validation
    ↓
Training Dataset
    ↓
Fine-tuning
    ↓
Model V2
```

Continual learning is an extension, not a requirement for V1.

### Temporal Liveness

Future anti-spoofing models can analyze multiple video frames instead of a single image:

```text
Frame t-4
Frame t-3
Frame t-2
Frame t-1
Frame t
    ↓
Temporal Model
    ↓
REAL / SPOOF
```

Potential approaches include CNN + GRU/LSTM, temporal convolution, 3D CNN, or temporal Transformer models.

### Camera-Specific Adaptation

If the initial public-dataset-trained anti-spoofing model performs poorly in the target environment:

```text
Camera Data
     ↓
Hard Examples
     ↓
Fine-tuning
     ↓
Anti-Spoof V2
```

---

## Design Principles

### 1. Identity data and model data are separate

```text
Employee CRUD
    ≠
Model Retraining
```

Adding, updating, or deleting an employee should normally only modify the identity store and embeddings.

### 2. Pretrained first, train only where necessary

V1 uses pretrained models for face detection and face embedding while focusing ML development effort on anti-spoofing.

### 3. Security and usability must coexist

Face authentication is the primary mechanism, anti-spoofing provides an additional security layer, and fingerprint provides operational redundancy.

### 4. Build the complete system before advanced ML

The project prioritizes a working end-to-end AIoT platform before adding continual learning, temporal liveness, or complex model adaptation.

---

## Proposed Technology Stack

The exact stack may evolve during implementation, but the initial direction is:

### AI / Computer Vision

* Python
* PyTorch
* YOLO
* OpenCV
* ArcFace / AdaFace
* MobileNetV3 / EfficientNet for anti-spoofing

### Backend

* FastAPI
* REST API
* Authentication / RBAC

### Database

* PostgreSQL
* pgvector

### IoT / Edge

* Raspberry Pi
* Camera
* Fingerprint sensor

### Frontend

* Web application
* Mobile application

### Storage

* Local/Object storage for approved images and datasets when required.

---

## Project Vision

SmartFace aims to evolve from a simple facial-recognition attendance prototype into an integrated employee-management platform:

```text
Employee
   ↓
Face / Fingerprint Authentication
   ↓
Attendance
   ↓
Working Hours
   ↓
Employee Management
   ↓
Payroll
```

The long-term goal is to make biometric authentication a practical part of everyday workforce management rather than an isolated AI component.

---

## Disclaimer

This project is intended as an engineering/research prototype. A production deployment should additionally address biometric-data protection, access control, auditability, retention/deletion policies, device security, attack resistance, and applicable legal/regulatory requirements.
