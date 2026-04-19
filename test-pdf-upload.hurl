POST http://localhost:3000/api/pdf-upload
Content-Type: multipart/form-data
[Multipart]
file: file, tests/fixtures/sample.pdf;

HTTP 200
[Captures]
hash: jsonpath "$.hash" 
[Asserts]
jsonpath "$.hash" matches "^[a-f0-9]{64}$"
jsonpath "$.url" == "/api/uploads/{{hash}}.pdf"
jsonpath "$.size" > 0

GET http://localhost:3000/api/uploads/{{hash}}.pdf
HTTP 200
[Asserts]
header "Content-Type" == "application/pdf"
header "Content-Disposition" matches "^inline; filename=\"[a-f0-9]{64}\\.pdf\"$"