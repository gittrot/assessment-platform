# AWS Cost Estimate - Adaptive Assessment Platform

## Infrastructure Summary

### Resources Deployed:
- **5 Lambda Functions** (Node.js 20.x)
- **6 DynamoDB Tables** (Pay-per-request billing)
- **1 API Gateway REST API**
- **1 Cognito User Pool**
- **CloudWatch Logs** (automatic)

---

## Monthly Cost Breakdown

### 1. Lambda Functions (5 total)

**Pricing:**
- First 1M requests/month: **FREE**
- Additional requests: $0.20 per 1M requests
- Compute time: $0.0000166667 per GB-second
- Free tier: 400,000 GB-seconds/month

**Assumptions:**
- Average memory: 512 MB (default)
- Average execution time: 500ms
- Monthly invocations: 100,000 (20,000 per function)

**Cost Calculation:**
- Requests: 100,000 = **FREE** (within free tier)
- Compute: 100,000 × 0.5s × 0.5GB = 25,000 GB-seconds = **FREE** (within free tier)

**Monthly Cost: $0.00** (within free tier)

---

### 2. DynamoDB Tables (6 tables, Pay-per-request)

**Pricing:**
- Write Request Units: $1.25 per million
- Read Request Units: $0.25 per million
- Storage: $0.25 per GB/month

**Assumptions:**
- 6 tables: Assessments, Questions, Sessions, Metrics, Insights, Dashboards
- 2 Global Secondary Indexes (GSI1 on Questions and Sessions)
- Monthly operations: 50,000 writes, 200,000 reads
- Average item size: 5 KB
- Total storage: ~500 MB (0.5 GB)

**Cost Calculation:**
- Writes: 50,000 × $1.25/1M = **$0.06**
- Reads: 200,000 × $0.25/1M = **$0.05**
- Storage: 0.5 GB × $0.25 = **$0.13**

**Monthly Cost: ~$0.24**

---

### 3. API Gateway (REST API)

**Pricing:**
- First 1M requests/month: **FREE**
- Additional requests: $3.50 per million
- Data transfer out: $0.09 per GB (first 10 TB)

**Assumptions:**
- Monthly API calls: 100,000
- Average response size: 10 KB
- Data transfer: ~1 GB/month

**Cost Calculation:**
- API requests: 100,000 = **FREE** (within free tier)
- Data transfer: 1 GB × $0.09 = **$0.09**

**Monthly Cost: ~$0.09**

---

### 4. Cognito User Pool

**Pricing:**
- First 50,000 MAUs (Monthly Active Users): **FREE**
- Additional MAUs: $0.0055 per MAU

**Assumptions:**
- 100 active users/month

**Cost Calculation:**
- 100 MAUs = **FREE** (within free tier)

**Monthly Cost: $0.00**

---

### 5. CloudWatch Logs

**Pricing:**
- First 5 GB ingestion/month: **FREE**
- Additional ingestion: $0.50 per GB
- Storage: $0.03 per GB/month

**Assumptions:**
- Log ingestion: ~2 GB/month (from 5 Lambda functions)
- Log retention: 7 days
- Storage: ~0.5 GB

**Cost Calculation:**
- Ingestion: 2 GB = **FREE** (within free tier)
- Storage: 0.5 GB × $0.03 = **$0.02**

**Monthly Cost: ~$0.02**

---

## Total Monthly Cost Estimate

| Service | Monthly Cost |
|---------|--------------|
| Lambda | $0.00 |
| DynamoDB | $0.24 |
| API Gateway | $0.09 |
| Cognito | $0.00 |
| CloudWatch Logs | $0.02 |
| **TOTAL** | **~$0.35/month** |

---

## Cost Scenarios

### Low Usage (Development/Testing)
- **10,000 API calls/month**
- **10,000 DynamoDB operations/month**
- **Estimated: ~$0.10/month**

### Medium Usage (Small Production)
- **100,000 API calls/month**
- **250,000 DynamoDB operations/month**
- **Estimated: ~$0.35/month**

### High Usage (Production)
- **1,000,000 API calls/month**
- **2,500,000 DynamoDB operations/month**
- **Estimated: ~$3.50/month**

### Very High Usage (Enterprise)
- **10,000,000 API calls/month**
- **25,000,000 DynamoDB operations/month**
- **Estimated: ~$35/month**

---

## Cost Optimization Tips

1. **DynamoDB:**
   - Consider Provisioned Capacity for predictable workloads (can be cheaper at scale)
   - Enable Point-in-Time Recovery only if needed ($0.20/GB)
   - Use DynamoDB Streams only if required

2. **Lambda:**
   - Right-size memory allocation (affects cost and performance)
   - Use Lambda Provisioned Concurrency only for critical functions
   - Consider Lambda@Edge for global distribution (if needed)

3. **API Gateway:**
   - Use API Gateway caching for frequently accessed data
   - Consider API Gateway HTTP API (cheaper) vs REST API if features allow

4. **CloudWatch:**
   - Set appropriate log retention periods (default is forever)
   - Use log filters to reduce ingestion
   - Consider exporting logs to S3 for long-term storage

5. **Cognito:**
   - Monitor MAU usage
   - Use MFA only when required (adds cost)

---

## Free Tier Benefits

✅ **AWS Free Tier (12 months for new accounts):**
- Lambda: 1M requests, 400K GB-seconds
- DynamoDB: 25 GB storage, 25 RCU, 25 WCU
- API Gateway: 1M requests
- Cognito: 50,000 MAUs
- CloudWatch: 5 GB ingestion, 10 custom metrics

**For new AWS accounts, the first year would be essentially FREE for low-medium usage!**

---

## Additional Costs to Consider

1. **Data Transfer:**
   - Outbound data transfer: $0.09/GB (first 10 TB)
   - Inter-region transfer: $0.02/GB

2. **OpenAI API Costs** (External):
   - Not included in AWS costs
   - GPT-4 Turbo: ~$0.01-0.03 per request
   - Could be significant depending on usage

3. **S3** (if used for file storage):
   - Storage: $0.023/GB
   - Requests: $0.005 per 1,000 requests

4. **Route 53** (if using custom domain):
   - Hosted zone: $0.50/month
   - Queries: $0.40 per million

---

## Notes

- All prices are for **us-east-1** region (as deployed)
- Prices may vary by region
- AWS pricing is subject to change
- Actual costs depend on real usage patterns
- Monitor costs using AWS Cost Explorer

---

**Bottom Line:** For a production-ready assessment platform, you're looking at approximately **$0.35-$3.50/month** depending on usage, which is extremely cost-effective!
