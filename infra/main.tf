terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source = "hashicorp/aws", version = "~> 6.0"
    }

  }
}
provider "aws" {
  region = var.region
}
variable "region" {
  type    = string
  default = "eu-west-2"
}
variable "name" {
  type    = string
  default = "hkgpipi-staging"
}
variable "vpc_id" {
  type = string
}
variable "public_subnet_ids" {
  type = list(string)
}
variable "private_subnet_ids" {
  type = list(string)
}
variable "certificate_arn" {
  type = string
}
variable "web_image" {
  type = string
}
variable "worker_image" {
  type = string
}
variable "runtime_secret_arn" {
  type = string
}
variable "application_url" {
  type = string
}
variable "discovery_role_arns" {
  type    = list(string)
  default = []
}
variable "smtp_host" {
  type = string
}
variable "smtp_port" {
  type    = number
  default = 465
}
variable "mail_from" {
  type = string
}
variable "legal_terms_url" {
  type = string
}
variable "legal_privacy_url" {
  type = string
}
variable "legal_terms_version" {
  type = string
}
variable "seller_legal_name" {
  type = string
}
variable "seller_address" {
  type = string
}
variable "tax_mode" {
  type = string
}
variable "tax_label" {
  type = string
}
variable "commercial_activation_approved" {
  type    = bool
  default = false
}
variable "desired_count" {
  type    = number
  default = 1
}
variable "log_retention_days" {
  type    = number
  default = 30
}
data "aws_caller_identity" "current" {}
data "aws_iam_policy_document" "ecs_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

  }
}
resource "aws_iam_role" "execution" {
  name               = "${var.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}
resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "runtime_secret" {
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = var.runtime_secret_arn
    }]
  })
}
resource "aws_iam_role" "application" {
  name               = "${var.name}-application"
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}
resource "aws_iam_role_policy" "files" {
  role = aws_iam_role.application.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "${aws_s3_bucket.files.arn}/*"
    }]
  })
}
resource "aws_iam_role_policy" "discovery" {
  count = length(var.discovery_role_arns) > 0 ? 1 : 0
  role  = aws_iam_role.application.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["sts:AssumeRole"], Resource = var.discovery_role_arns
    }]
  })
}
resource "aws_s3_bucket" "files" {
  bucket_prefix = "${var.name}-private-"
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id
  versioning_configuration {
    status = "Enabled"
  }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_policy" "tls" {
  bucket = aws_s3_bucket.files.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Sid = "DenyInsecureTransport", Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.files.arn, "${aws_s3_bucket.files.arn}/*"], Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }
      }
    }]
  })
}
resource "aws_security_group" "alb" {
  name_prefix = "${var.name}-alb-"
  vpc_id      = var.vpc_id
}
resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}
resource "aws_vpc_security_group_egress_rule" "alb_web" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}
resource "aws_security_group" "app" {
  name_prefix = "${var.name}-app-"
  vpc_id      = var.vpc_id
}
resource "aws_vpc_security_group_ingress_rule" "web" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}
resource "aws_vpc_security_group_ingress_rule" "scanner" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 3310
  to_port                      = 3310
  ip_protocol                  = "tcp"
}
resource "aws_vpc_security_group_egress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}
resource "aws_vpc_security_group_egress_rule" "app_smtp" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = var.smtp_port
  to_port           = var.smtp_port
  ip_protocol       = "tcp"
}
resource "aws_vpc_security_group_egress_rule" "app_database" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.db.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
resource "aws_security_group" "db" {
  name_prefix = "${var.name}-db-"
  vpc_id      = var.vpc_id
}
resource "aws_vpc_security_group_ingress_rule" "database" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
resource "aws_db_subnet_group" "main" {
  name       = var.name
  subnet_ids = var.private_subnet_ids
}
resource "aws_db_instance" "main" {
  identifier                  = var.name
  engine                      = "postgres"
  engine_version              = "17"
  instance_class              = "db.t4g.small"
  allocated_storage           = 20
  max_allocated_storage       = 100
  storage_encrypted           = true
  db_name                     = "hkgpipi"
  username                    = "hkgpipi_migration"
  manage_master_user_password = true
  publicly_accessible         = false
  vpc_security_group_ids      = [aws_security_group.db.id]
  db_subnet_group_name        = aws_db_subnet_group.main.name
  backup_retention_period     = 7
  deletion_protection         = true
  skip_final_snapshot         = false
  final_snapshot_identifier   = "${var.name}-final"
  auto_minor_version_upgrade  = true
  lifecycle {
    prevent_destroy = true
  }
}
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days
}
resource "aws_ecs_cluster" "main" {
  name = var.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
resource "aws_lb" "main" {
  name                       = var.name
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true
}
resource "aws_lb_target_group" "web" {
  name        = var.name
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path                = "/api/health"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}
locals {
  environment = [for key, value in {
    NODE_ENV                = "production", BETTER_AUTH_URL = var.application_url, NEXT_PUBLIC_APP_URL = var.application_url, DATABASE_SSL = "true", TRUSTED_PROXY = "alb",
    PAYMENTS_PROVIDER       = "stripe", ENABLE_TEST_PAYMENTS = "false", STRIPE_AUTOMATIC_TAX = "true",
    LEGAL_APPROVED          = tostring(var.commercial_activation_approved), TAX_APPROVED = tostring(var.commercial_activation_approved), LEGAL_TERMS_URL = var.legal_terms_url, LEGAL_PRIVACY_URL = var.legal_privacy_url, LEGAL_TERMS_VERSION = var.legal_terms_version, SELLER_LEGAL_NAME = var.seller_legal_name, SELLER_ADDRESS = var.seller_address, TAX_MODE = var.tax_mode, TAX_LABEL = var.tax_label,
    SMTP_HOST               = var.smtp_host, SMTP_PORT = tostring(var.smtp_port), SMTP_SECURE = tostring(var.smtp_port == 465), MAIL_FROM = var.mail_from,
    FILE_STORAGE_PROVIDER   = "s3", S3_BUCKET = aws_s3_bucket.files.id, S3_REGION = var.region, AWS_REGION = var.region,
    AWS_INTEGRATION_ENABLED = tostring(length(var.discovery_role_arns) > 0), AWS_DISCOVERY_PRINCIPAL_ARN = aws_iam_role.application.arn, CLAMAV_HOST = "127.0.0.1", CLAMAV_PORT = "3310"

    } : {
    name = key, value = value
  }]
  secrets = [for key in ["DATABASE_URL", "BETTER_AUTH_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SMTP_USER", "SMTP_PASSWORD"] : {
    name = key, valueFrom = "${var.runtime_secret_arn}:${key}::"
  }]
}
resource "aws_ecs_task_definition" "app" {
  for_each = {
    web = var.web_image, worker = var.worker_image
  }
  family                   = "${var.name}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "3072"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.application.arn
  container_definitions = jsonencode([
    {
      name = each.key, image = each.value, essential = true, environment = local.environment, secrets = local.secrets, portMappings = each.key == "web" ? [{
        containerPort = 3000, protocol = "tcp"
        }] : [], logConfiguration = {
        logDriver = "awslogs", options = {
          "awslogs-group" = aws_cloudwatch_log_group.app.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = each.key
        }
      }
    },
    {
      name = "scanner", image = "clamav/clamav:stable", essential = true, cpu = 256, memory = 2048, logConfiguration = {
        logDriver = "awslogs", options = {
          "awslogs-group" = aws_cloudwatch_log_group.app.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = "scanner-${each.key}"
        }
      }
    }
  ])
}
resource "aws_ecs_service" "app" {
  for_each        = aws_ecs_task_definition.app
  name            = "${var.name}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = each.value.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }
  dynamic "load_balancer" {
    for_each = each.key == "web" ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.web.arn
      container_name   = "web"
      container_port   = 3000
    }

  }
  depends_on = [aws_lb_listener.https]
}
resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "${var.name}-database-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2147483648
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
}
output "load_balancer_dns" {
  value = aws_lb.main.dns_name
}
output "database_endpoint" {
  value = aws_db_instance.main.endpoint
}
output "migration_secret_arn" {
  value = aws_db_instance.main.master_user_secret[0].secret_arn
}
output "discovery_principal_arn" {
  value = aws_iam_role.application.arn
}
output "private_bucket" {
  value = aws_s3_bucket.files.id
}
