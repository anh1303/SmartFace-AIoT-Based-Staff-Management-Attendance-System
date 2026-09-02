# SmartFace: AIoT-Based Staff Management & Attendance System

> An AIoT-based employee management and attendance platform integrating face authentication, spatial-frequency presentation attack detection (PAD), and fingerprint fallback.

## Overview

**SmartFace** is an AIoT-based employee management and attendance platform designed to modernize traditional staff attendance and workforce-management workflows.

Traditional methods such as RFID/proximity cards, ID cards, PINs, and passwords can be lost, forgotten, borrowed, or shared. They can also introduce additional interaction steps and leave employee information, attendance records, and payroll-related data distributed across separate systems.

SmartFace uses **face authentication as the primary identity mechanism**, **Presentation Attack Detection (PAD)** as a security layer, and **fingerprint authentication as a fallback mechanism**.

The project connects biometric authentication, attendance, employee self-service, management operations, working-hour information, and payroll-related data into one platform.

```text
Employee
   ↓
Face / Fingerprint Authentication
   ↓
Check-in / Check-out
   ↓
Attendance & Working Hours
   ↓
Employee Management
   ↓
Payroll-related Data
```

---

## Motivation

The project aims to move employee authentication from methods based mainly on:

```text
Something you have
→ RFID / Attendance Card
```

or:

```text
Something you know
→ PIN / Password
```

toward:

```text
Something you are
→ Face
```

Face authentication provides a contactless and convenient way to identify employees during attendance. However, face recognition alone is not sufficient for a security-sensitive system because an attacker may present a photo, printed image, replayed video, or another presentation attack.

Therefore, SmartFace separates authentication into three conceptual stages:

```text
Face Detection
      ↓
Presentation Attack Detection (PAD)
      ↓
Face Recognition
      ↓
Identity Matching
```

The system also provides fingerprint as a fallback authentication channel so that attendance does not depend entirely on a single biometric modality.

---

# Key Features

## AI-powered face attendance

- Face detection using a pretrained YOLO model.
- Face alignment and quality checking.
- Lightweight RGB single-frame Presentation Attack Detection.
- Face embedding using a pretrained recognition model.
- Vector similarity search.
- Face-based check-in.
- Face-based check-out.

## Fingerprint fallback

Fingerprint provides a secondary authentication path when face authentication is unavailable or unsuitable.

Examples include:

- Poor image quality.
- Face occlusion.
- Camera failure.
- Temporary recognition failure.

Attendance records preserve the authentication method:

```text
FACE
FINGERPRINT
```

## Employee management

Managers and administrators can:

- Add employees.
- Edit employee information.
- Enable or disable employees.
- Search and filter employees.
- Manage employee profiles.
- Enroll and update face data.
- Manage authentication status.

## Employee self-service

Employees can:

- View personal information.
- View department and position.
- View working schedules.
- View attendance history.
- View check-in/check-out records.
- View working hours.
- Update permitted profile information.
- Update or re-enroll face data.

## Attendance management

The platform records:

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

- Daily attendance.
- Late arrivals.
- Early departures.
- Missing check-in/check-out.
- Attendance history.

## Payroll-related information

Attendance data can be used as input for payroll workflows:

```text
Attendance
    ↓
Working Hours
    ↓
Late / Early Leave / Overtime
    ↓
Payroll Calculation
```

The platform is designed to provide reliable attendance and working-hour data that can be integrated with payroll processes.

---

# System Architecture

```text
                         ┌────────────────────┐
                         │      Camera        │
                         │ Raspberry Pi /     │
                         │ IoT Edge Device    │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Face Detection     │
                         │ Pretrained YOLO    │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Alignment +        │
                         │ Quality Check       │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Spatial-Frequency  │
                         │ PAD                │
                         │ REAL / SPOOF       │
                         └─────────┬──────────┘
                                   │
                              REAL FACE
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Face Embedding     │
                         │ Pretrained Model   │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Vector Search      │
                         │ pgvector / Qdrant  │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │ Identity Decision  │
                         └─────────┬──────────┘
                                   │
                       ┌───────────┴───────────┐
                       ▼                       ▼
                   CHECK-IN                CHECK-OUT
                       │                       │
                       └───────────┬───────────┘
                                   ▼
                         ┌────────────────────┐
                         │ Attendance Service │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         Employee / Payroll
                           Management
```

Fingerprint fallback:

```text
Face Authentication
        │
        └── unavailable / failed
                    ↓
               Fingerprint
                    ↓
              Identity Verify
                    ↓
             Check-in / Check-out
```

---

# AI Architecture

SmartFace uses three main AI components.

## Face Detection

A pretrained YOLO model detects faces from camera frames:

```text
Camera Frame
     ↓
Pretrained YOLO
     ↓
Face Bounding Box
```

The detector is used as a pretrained component rather than being trained from scratch.

## Presentation Attack Detection

The PAD model is the main computer-vision research component of the system.

The proposed architecture combines:

- A **spatial branch** using MobileNetV3-Large.
- A **frequency branch** using 2D DCT followed by a lightweight CNN.
- Feature fusion through concatenation.

```text
                         FACE IMAGE
                           224×224
                              │
             ┌────────────────┴────────────────┐
             │                                 │
             ▼                                 ▼
       SPATIAL BRANCH                    FREQUENCY BRANCH
       MobileNetV3-Large                       │
       ImageNet pretrained                     ▼
             │                                2D DCT
             ▼                                  │
      Feature Extraction                        ▼
             │                            Frequency Map
             ▼                                  │
       Spatial Feature                          ▼
           256-D                         Lightweight CNN
                                                │
                                                ▼
                                        Frequency Feature
                                             64-D
             │                                 │
             └────────────────┬────────────────┘
                              ▼
                         FEATURE FUSION
                           Concatenate
                              │
                             320-D
                              │
                              ▼
                            MLP / FC
                              │
                             128-D
                              │
                              ▼
                         PAD CLASSIFIER
                              │
                              ▼
                         REAL / SPOOF
```

### Spatial branch

```text
224×224×3
    ↓
MobileNetV3-Large
    ↓
Global Average Pooling
    ↓
Projection
    ↓
256-D Spatial Feature
```

### Frequency branch

The frequency branch uses a luminance/grayscale representation:

```text
RGB Face
   ↓
Luminance / Grayscale
   ↓
224 × 224
   ↓
2D DCT
   ↓
Frequency Map
```

The frequency representation can be normalized before being processed by a lightweight CNN.

```text
Frequency Map
     ↓
Depthwise / Pointwise Convolutions
     ↓
Global Average Pooling
     ↓
Linear Projection
     ↓
64-D Frequency Feature
```

### Why frequency information?

Spatial CNNs can learn facial structure, edges, texture, illumination, and local patterns.

Presentation attacks may also introduce low-level reproduction artifacts such as:

- Paper and ink texture.
- Display patterns.
- Pixel/subpixel structures.
- Moiré and aliasing.
- Compression or reproduction artifacts.

Frequency-domain features are investigated as complementary information.

> **High frequency does not mean spoof.**

Real faces also contain high-frequency information. The objective is to learn discriminative frequency patterns rather than simply measuring the amount of high-frequency content.

---

# PAD Research Direction

The frequency branch is evaluated against a spatial-only baseline.

## Spatial-only baseline

```text
Face Image
    ↓
MobileNetV3-Large
    ↓
256-D Spatial Feature
    ↓
Classifier
    ↓
REAL / SPOOF
```

## Frequency-aware model

```text
                         Face Image
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
        MobileNetV3-Large                  DCT
                │                           │
                ▼                           ▼
         Spatial 256-D              Tiny Frequency CNN
                                           │
                                           ▼
                                      Frequency 64-D
                └─────────────┬─────────────┘
                              ▼
                            Fusion
                              ↓
                          Classifier
                              ↓
                           REAL / SPOOF
```

The goal is to determine whether explicit frequency-domain information improves PAD performance, particularly under domain changes, while keeping additional computational cost low.

This is an empirical research question; the project does not assume that the frequency branch will always improve results.

---

# PAD Evaluation

The evaluation focuses on both security and generalization.

Important metrics include:

- APCER — Attack Presentation Classification Error Rate.
- BPCER — Bona Fide Presentation Classification Error Rate.
- ACER — Average Classification Error Rate.

```text
ACER = (APCER + BPCER) / 2
```

Cross-dataset evaluation can be performed using public datasets such as:

- CelebA-Spoof.
- OULU-NPU.
- SiW.
- SiW-Mv2.
- MSU-MFSD.

The main objective is to investigate whether the spatial-frequency representation generalizes better when identities, environments, cameras, or presentation attacks change.

---

# Face Embedding & Recognition

SmartFace uses a pretrained face-recognition model rather than training an embedding network from scratch.

Candidate approaches include:

- ArcFace.
- AdaFace.
- Equivalent pretrained face-recognition models.

Pipeline:

```text
Validated Face
      ↓
Face Embedding Model
      ↓
Embedding Vector
      ↓
Normalization
      ↓
Vector Search
```

---

# Identity Enrollment

An employee can have multiple face samples rather than a single embedding:

```text
Employee A
 ├── Frontal
 ├── Left
 ├── Right
 ├── Smile
 ├── Glasses
 └── Different lighting
```

Enrollment flow:

```text
Camera
   ↓
Face Detection
   ↓
Quality Check
   ↓
PAD
   ↓
Face Alignment
   ↓
Embedding
   ↓
Multiple Embeddings
   ↓
Vector Store
```

This allows the system to accommodate moderate appearance changes without retraining the face embedding model.

---

# Identity Matching

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
Similarity Threshold
    ↓
Identity
```

A final decision can consider multiple signals:

```text
Face Similarity
+
Face Quality
+
PAD Score
+
System Policy
```

---

# Employee Management

Identity data is intentionally separated from AI models.

## Add employee

```text
Create Employee
      ↓
Face Enrollment
      ↓
Generate Embeddings
      ↓
Store Embeddings
```

Adding an employee does not require model retraining.

## Update face

```text
New Face Samples
      ↓
Quality Check
      ↓
PAD
      ↓
Generate Embeddings
      ↓
Update Vector Store
```

Employees can re-enroll after changes such as:

- Different hairstyle.
- Beard or shaved beard.
- Glasses.
- Significant appearance changes.
- Additional enrollment requirements.

## Delete employee

A soft-delete/inactive state can be used:

```text
Employee
   ↓
INACTIVE / DELETED
   ↓
Deactivate related embeddings
```

---

# Two-Way Attendance

## Check-in

```text
Employee arrives
      ↓
Camera detects face
      ↓
Quality check
      ↓
PAD
      ↓
Face recognition
      ↓
Identity match
      ↓
CHECK-IN
      ↓
Attendance database
```

## Check-out

```text
Employee leaves
      ↓
Camera detects face
      ↓
Quality check
      ↓
PAD
      ↓
Face recognition
      ↓
Identity match
      ↓
CHECK-OUT
      ↓
Attendance database
```

## Fingerprint fallback

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

# Web / Mobile Application

SmartFace provides separate experiences for managers and employees.

## Manager / Admin

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

Functions include:

- Employee list management.
- Employee profile management.
- Face enrollment/update.
- Attendance monitoring.
- Check-in/check-out history.
- Late/early leave tracking.
- Payroll-related data.
- IoT device monitoring.

## Employee

Main modules:

```text
My Profile
My Schedule
My Attendance
My Working Hours
My Face
```

Employees can:

- View personal information.
- View working schedule.
- View attendance history.
- View working hours.
- Update permitted profile fields.
- Update or re-enroll face data.

---

# Role-Based Access Control

## Admin

- Full employee management.
- Attendance management.
- Payroll-related management.
- Device management.
- Account and permission management.
- System configuration.

## Manager

- Employee list and profiles.
- Attendance monitoring.
- Working-hour information.
- Payroll-related attendance data.
- Device status.

## Employee

- Personal profile.
- Working information.
- Attendance history.
- Check-in/check-out records.
- Working hours.
- Face enrollment/update.

Employees only access information and actions authorized for their role.

---

# Data Architecture

A practical implementation can use PostgreSQL together with pgvector.

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

Model versioning allows embeddings from different face-recognition models to be handled safely during future migrations.

---

# IoT Architecture

Raspberry Pi or another edge device can interface with physical devices:

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

# Technology Stack

## AI / Computer Vision

- Python
- PyTorch
- YOLO
- OpenCV
- MobileNetV3-Large
- 2D DCT
- Lightweight CNN
- ArcFace / AdaFace

## Backend

- FastAPI
- REST API
- Authentication
- Role-Based Access Control

## Database

- PostgreSQL
- pgvector

## IoT / Edge

- Raspberry Pi
- Camera
- Fingerprint sensor

## Frontend

- Web application
- Mobile application

## Storage

- Local or object storage for approved images and datasets when required.

---

# Project Structure

A suggested repository structure:

```text
smartface/
├── apps/
│   ├── web/
│   └── mobile/
│
├── backend/
│   ├── api/
│   ├── services/
│   ├── models/
│   └── database/
│
├── ai/
│   ├── face_detection/
│   ├── pad/
│   │   ├── baseline/
│   │   ├── frequency/
│   │   ├── datasets/
│   │   ├── training/
│   │   └── evaluation/
│   └── face_embedding/
│
├── edge/
│   ├── camera/
│   └── fingerprint/
│
├── docs/
│
├── tests/
│
└── README.md
```

The exact repository structure may evolve during implementation.

---

# Future Extensions

## Continual Learning

Production data can later be incorporated through:

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
Model Update
```

Continual learning is intended as an extension rather than a dependency of the core system.

## Temporal Liveness

The current PAD concept is single-frame. A future system can use multiple frames:

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

## Camera-specific adaptation

If public-data-trained PAD performs poorly on a target environment:

```text
Camera Data
     ↓
Hard Examples
     ↓
Fine-tuning
     ↓
Updated PAD Model
```

---

# Design Principles

### Identity data and AI models are separate

```text
Employee CRUD
    ≠
Model Retraining
```

Adding, updating, or deleting an employee normally changes identity data and embeddings, not the AI models.

### Pretrained first, train where the project has a clear research question

Face detection and face embedding use pretrained models, while PAD provides the main model-development and experimentation component.

### PAD complements face recognition

Face recognition asks:

> Which enrolled identity does this face resemble?

PAD asks:

> Is this a genuine presentation or a presentation attack?

### Security, generalization, and efficiency matter together

The PAD architecture is evaluated not only by classification performance, but also by cross-domain behavior and computational cost.

### Build the integrated system before advanced learning

The platform prioritizes a working AIoT employee-management workflow. Continual learning and temporal liveness are future extensions.

---

# Project Vision

SmartFace aims to become an integrated workforce-management platform in which biometric authentication is a practical part of everyday employee operations:

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

The long-term vision is to bring together:

**secure identity verification + convenient attendance + employee self-service + workforce management + IoT devices**

within a single platform.

---

## Disclaimer

This project is intended as an engineering and research-oriented prototype.

A production deployment should additionally address:

- Biometric-data protection.
- Authentication and authorization security.
- Auditability.
- Retention and deletion policies.
- Device security.
- Presentation and injection attack resistance.
- Model monitoring.
- Applicable legal and regulatory requirements.
