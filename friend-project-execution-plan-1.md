# Friend Project Execution Plan

## Lower-pressure proof projects first
1. Logistics + Car Sales Copilot
2. SoftTouch Repair + Parts Intelligence

Use these two to sharpen delivery, get portfolio-ready demos, and create confidence before the Malaria Consortium proposal.

## Logistics + Car Sales Copilot
Goal: build a simple AI-assisted ops dashboard for tracking cars, shipment documents, and customer updates from Dallas to Lagos.

MVP:
- vehicle tracker
- document intake
- field extraction
- delayed / missing-doc dashboard
- customer status update generator

Stack:
- FastAPI
- SQLite or Postgres
- file upload
- simple dashboard
- optional LLM drafting

## SoftTouch Repair + Parts Intelligence
Goal: build a grounded assistant over manuals, repair notes, and part information to answer technical questions faster.

MVP:
- document upload
- text extraction + chunking
- grounded search
- answer builder with sources
- quote-support helper

Stack:
- FastAPI
- SQLite
- PDF/text extraction
- keyword retrieval first
- embeddings later

## Delivery rule
Keep scope narrow. Deliver MVP first. Get feedback quickly. Reuse the same architecture across both proof projects.
