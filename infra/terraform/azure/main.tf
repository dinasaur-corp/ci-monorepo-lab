terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm" }
  }
}

variable "environment" {
  type = string
}
